import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { Client, IntentsBitField, Options, Partials } from 'discord.js';
import { container } from 'tsyringe';
import { deploySlashCommands } from './deploy';
import { CommandHandler } from '#struct/CommandHandler';
import { Env } from '#struct/Env';
import { EventHandler } from '#struct/EventHandler';

const env = container.resolve(Env);

const client = new Client({
	intents: [IntentsBitField.Flags.Guilds],
	partials: [Partials.Channel, Partials.Message],
	makeCache: Options.cacheWithLimits({
		MessageManager: 100,
	}),
}).setMaxListeners(20);
container.register(Client, { useValue: client });
container.register(PrismaClient, { useValue: new PrismaClient() });

if (env.deploySlashCommands) {
	await deploySlashCommands();
	process.exit(0);
}

await container.resolve(CommandHandler).init();
await container.resolve(EventHandler).init();

await client.login(process.env.DISCORD_TOKEN);
