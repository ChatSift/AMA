import 'reflect-metadata';

import { container } from 'tsyringe';
import { Rest } from '@cordis/rest';
import Redis from 'ioredis';
import postgres, { Sql } from 'postgres';
import { kRedis, kRest, kLogger, kSQL, initConfig } from '@ama/common';
import createLogger from '@ama/logger';
import { readdirRecurse } from '@ama/readdir';
import { join as joinPath } from 'path';
import { getCommandInfo, Command, COMMANDS } from './Command';
import {
  GatewayDispatchEvents,
  RESTGetAPIApplicationCommandsResult,
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPostAPIApplicationCommandsResult,
  Routes
} from 'discord-api-types/v8';
import type { Logger } from 'winston';

const main = async () => {
  const config = initConfig();

  const redis = new Redis(config.redisUrl);
  const rest = new Rest(config.discordToken, {
    // mutex: new RedisMutex(redis)
  });
  const logger = createLogger('HANDLER');
  const sql = postgres(config.dbUrl, {
    onnotice: notice => logger.debug(JSON.stringify(notice, null, 2), { topic: 'DB NOTICE' })
  });

  rest
    .on('response', async (req, res, rl) => {
      if (!res.ok) {
        logger.warn(`Failed request ${req.method} ${req.path}`, {
          topic: 'REQUEST FAILURE',
          res: await res.json(),
          rl
        });
      }
    })
    .on('ratelimit', (bucket, endpoint, prevented, waitingFor) => {
      logger.warn(`Hit a ratelimit on ${endpoint}`, {
        topic: 'RATELIMIT',
        bucket,
        prevented,
        waitingFor
      });
    });

  if (config.nodeEnv === 'dev') {
    rest.on('request', req => logger.debug(`Making request ${req.method} ${req.path}`, { topic: 'REQUEST START' }));
  }

  container.register<Redis.Redis>(kRedis, { useValue: redis });
  container.register<Rest>(kRest, { useValue: rest });
  container.register<Logger>(kLogger, { useValue: logger });
  container.register<Sql<{}>>(kSQL, { useValue: sql });

  // Dynamically imported so symbols are registered into tsyringe
  const { makeGateway } = await import('./gateway');

  // Load all the known API commands
  const interactionsApiRoutes = config.nodeEnv === 'prod'
    ? Routes.applicationCommands(config.clientId)
    : Routes.applicationGuildCommands(config.clientId, config.testGuildId!);

  // And map them by name-id
  const unseenRegisteredCommands = new Map(
    await rest
      .get<RESTGetAPIApplicationCommandsResult, never>(interactionsApiRoutes)
      .then(arr => arr.map(e => [e.name, e.id]))
  );

  // Update/create every interaction
  for await (const file of readdirRecurse(joinPath(__dirname, 'interactions'), { fileExtension: 'js' })) {
    const data: RESTPostAPIApplicationCommandsJSONBody = (await import(file)).default;
    unseenRegisteredCommands.delete(data.name);
    await rest.post<RESTPostAPIApplicationCommandsResult, RESTPostAPIApplicationCommandsJSONBody>(interactionsApiRoutes, { data });
  }

  // Anything that wasn't covered in the past iteration means it has been deletedc locally, so delete it on Discord's end too
  for (const command of unseenRegisteredCommands.values()) {
    await rest.delete(
      config.nodeEnv === 'prod'
        ? Routes.applicationCommand(config.clientId, command)
        : Routes.applicationGuildCommand(config.clientId, config.testGuildId!, command)
    );
  }

  for await (const file of readdirRecurse(joinPath(__dirname, 'commands'), { fileExtension: 'js' })) {
    if (file.includes('/sub/')) continue;

    const info = getCommandInfo(file);
    if (info) {
      logger.info(`Loading command "${info.name}"`, { topic: 'HANDLER INIT' });

      const command = container.resolve<Command>((await import(file)).default);
      COMMANDS.set(command.name ?? info.name, command);
      continue;
    }

    logger.warn(`Failed to dig out command metadata from path "${file}"`, { topic: 'HANDLER INIT' });
  }

  const gateway = await makeGateway();
  await gateway.init({
    name: 'gateway',
    keys: [GatewayDispatchEvents.InteractionCreate, GatewayDispatchEvents.MessageReactionAdd],
    queue: 'handler'
  });
};

void main();
