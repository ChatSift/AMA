import 'reflect-metadata';

import { container } from 'tsyringe';
import { buildRestRouter, IRouter, Rest } from '@cordis/rest';
import Redis from 'ioredis';
import postgres, { Sql } from 'postgres';
import { kRedis, kRest, kLogger, kSQL, initConfig } from '@ama/common';
import { readdirRecurse } from '@gaius-bot/readdir';
import { join as joinPath } from 'path';
import { getCommandInfo, Command, COMMANDS } from './Command';
import {
  GatewayDispatchEvents,
  RESTGetAPIApplicationCommandsResult,
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPostAPIApplicationCommandsResult,
  Routes
} from 'discord-api-types/v8';
import createLogger, { Logger } from 'pino';

const main = async () => {
  const config = initConfig();

  const redis = new Redis(config.redisUrl);
  const rest = new Rest(config.discordToken);

  const logger = createLogger({
    name: 'HANDLER',
    level: config.nodeEnv === 'prod' ? 'info' : 'trace'
  });

  const sql = postgres(config.dbUrl, {
    onnotice: notice => logger.debug(JSON.stringify(notice, null, 2), { topic: 'DB NOTICE' })
  });

  rest
    .on('response', async (req, res, rl) => {
      if (!res.ok) {
        logger.warn({
          topic: 'REQUEST FAILURE',
          res: await res.json(),
          rl
        }, `Failed request ${req.method} ${req.path}`);
      }
    })
    .on('ratelimit', (bucket, endpoint, prevented, waitingFor) => {
      logger.warn({
        topic: 'RATELIMIT',
        bucket,
        prevented,
        waitingFor
      }, `Hit a ratelimit on ${endpoint}`);
    });

  if (config.nodeEnv === 'dev') {
    rest.on('request', req => logger.trace({ topic: 'REQUEST START' }, `Making request ${req.method} ${req.path}`));
  }

  container.register<Redis.Redis>(kRedis, { useValue: redis });
  container.register<IRouter>(kRest, { useValue: buildRestRouter(rest) });
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
      logger.trace({ topic: 'HANDLER INIT' }, `Loading command "${info.name}"`);

      const command = container.resolve<Command>((await import(file)).default);
      COMMANDS.set(command.name ?? info.name, command);
      continue;
    }

    logger.warn({ topic: 'HANDLER INIT' }, `Failed to dig out command metadata from path "${file}"`);
  }

  const gateway = await makeGateway();
  await gateway.init({
    name: 'gateway',
    keys: [GatewayDispatchEvents.InteractionCreate, GatewayDispatchEvents.MessageReactionAdd],
    queue: 'handler'
  });
};

void main();
