import 'reflect-metadata';

import { container } from 'tsyringe';
import { RoutingClient, createAmqp } from '@cordis/brokers';
import { RestManager, RedisMutex } from '@cordis/rest';
import Redis from 'ioredis';
import postgres, { Sql } from 'postgres';
import { kRedis, kRest, kLogger, kSQL, initConfig } from '@ama/common';
import createLogger from '@ama/logger';
import { readdirRecurse } from '@ama/readdir';
import { join as joinPath } from 'path';
import { getCommandInfo, Command, UserPermissions } from './Command';
import { parseInteraction } from './parser';
import { Args } from 'lexure';
import { memberPermissions, send } from './util';
import {
  GatewayDispatchEvents,
  RESTGetAPIApplicationCommandsResult,
  RESTPostAPIApplicationCommandsJSONBody,
  RESTPostAPIApplicationCommandsResult,
  Routes
} from 'discord-api-types/v8';
import type { Logger } from 'winston';
import type { DiscordEvents } from '@cordis/common';

const COMMANDS = new Map<string, Command>();

const main = async () => {
  const config = initConfig();

  const redis = new Redis(config.redisUrl);
  const rest = new RestManager(config.discordToken, { mutex: new RedisMutex(redis) });
  const logger = createLogger('HANDLER');
  const sql = postgres(config.dbUrl, {
    onnotice: notice => logger.debug(JSON.stringify(notice, null, 2), { topic: 'DB NOTICE' })
  });

  container.register<Redis.Redis>(kRedis, { useValue: redis });
  container.register<RestManager>(kRest, { useValue: rest });
  container.register<Logger>(kLogger, { useValue: logger });
  container.register<Sql<{}>>(kSQL, { useValue: sql });

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
    // TODO: Wait for cordis 0.1.7 for this to compile
    // @ts-ignore
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

  const { channel } = await createAmqp(config.amqpUrl);
  const gateway = new RoutingClient<keyof DiscordEvents, DiscordEvents>(channel);

  await gateway
    .on(GatewayDispatchEvents.InteractionCreate, async interaction => {
      const parsed = parseInteraction(interaction.data.options ?? []);

      const command = COMMANDS.get(interaction.data.name);

      if (command) {
        try {
          if (command.userPermissions) {
            const memberPerms = await memberPermissions(interaction);
            if (memberPerms < command.userPermissions) {
              throw new Error(`Missing permission to run that command. You should be at least a ${UserPermissions[command.userPermissions]}`);
            }
          }

          await command.exec(interaction, new Args(parsed));
        } catch (e) {
          void send(interaction, { content: e.message, flags: 64 }, 3);
        }
      }

      void send(interaction, {}, 2);
    })
    .init({ name: 'gateway', keys: [GatewayDispatchEvents.InteractionCreate], queue: 'handler' });
};

void main();
