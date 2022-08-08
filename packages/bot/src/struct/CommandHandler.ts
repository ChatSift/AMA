import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdirRecurse } from '@chatsift/readdir';
import { REST } from '@discordjs/rest';
import { PrismaClient } from '@prisma/client';
import {
	AutocompleteInteraction,
	CommandInteraction,
	inlineCode,
	MessageComponentInteraction,
	Routes,
} from 'discord.js';
import { container, singleton } from 'tsyringe';
import type { Command, CommandConstructor } from '#struct/Command';
import { Component, ComponentConstructor, getComponentInfo } from '#struct/Component';
import { Env } from '#struct/Env';
import { logger } from '#util/logger';

@singleton()
export class CommandHandler {
	public readonly commands = new Map<string, Command>();
	public readonly components = new Map<string, Component>();

	public constructor(private readonly env: Env, private readonly prisma: PrismaClient) {}

	public async handleAutocomplete(interaction: AutocompleteInteraction) {
		const command = this.commands.get(interaction.commandName);

		if (!command?.handleAutocomplete) {
			return interaction.respond([]);
		}

		if (command.interactionOptions.dm_permission && interaction.inCachedGuild()) {
			return;
		}

		try {
			const options = await command.handleAutocomplete(interaction);
			return await interaction.respond(options.slice(0, 25));
		} catch (err) {
			logger.error({ err, command: interaction.commandName }, 'Error handling autocomplete');
			return interaction.respond([
				{
					name: 'Something went wrong fetching auto complete options. Please report this bug.',
					value: 'noop',
				},
			]);
		}
	}

	public async handleMessageComponent(interaction: MessageComponentInteraction<'cached'>) {
		const [name, ...args] = interaction.customId.split('|') as [string, ...string[]];
		const component = this.components.get(name);

		try {
			// eslint-disable-next-line @typescript-eslint/return-await
			return await component?.handle(interaction, ...args);
		} catch (err) {
			logger.error({ err, component: name }, 'Error handling message component');
			const content = `Something went wrong running component. Please report this bug.\n\n${inlineCode(
				(err as Error).message,
			)}`;

			// Try to display something to the user. We don't actually know what our component has done response wise, though
			await interaction.reply({ content }).catch(() => null);
			await interaction.update({ content }).catch(() => null);
		}
	}

	public async handleCommand(interaction: CommandInteraction) {
		const command = this.commands.get(interaction.commandName);
		if (!command) {
			logger.warn(interaction, 'Command interaction not registered locally was not chatInput');
			return interaction.reply('Command not found. This is most certainly a bug');
		}

		if (!command.interactionOptions.dm_permission && !interaction.inCachedGuild()) {
			return logger.warn(
				{ interaction, command },
				'Command interaction had dm_permission off and was not in cached guild',
			);
		}

		try {
			// @ts-expect-error - Yet another instance of odd union behavior. Unsure if there's a way to avoid this
			// eslint-disable-next-line @typescript-eslint/return-await
			return await command.handle(interaction);
		} catch (err) {
			// TODO(DD): Consider dealing with specific error
			logger.error({ err, command: interaction.commandName }, 'Error handling command');
			const content = `Something went wrong running command. This could be a bug, or it could be related to your permissions.\n\n${inlineCode(
				(err as Error).message,
			)}`;

			// Try to display something to the user.
			await interaction.reply({ content }).catch(() => null);
		}
	}

	public init(): Promise<void[]> {
		return Promise.all([this.registerCommands(), this.registerComponents()]);
	}

	public async registerInteractions(): Promise<void> {
		const api = new REST().setToken(this.env.discordToken);
		const options = [...this.commands.values()].map((command) => command.interactionOptions);
		await api.put(Routes.applicationCommands(this.env.discordClientId), { body: options });
	}

	private async registerCommands(): Promise<void> {
		const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'commands');
		const files = readdirRecurse(path, { fileExtensions: ['js'] });

		for await (const file of files) {
			const mod = (await import(pathToFileURL(file).toString())) as { default: CommandConstructor };
			const command = container.resolve(mod.default);

			this.commands.set(command.interactionOptions.name, command);
		}
	}

	private async registerComponents(): Promise<void> {
		const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'components');
		const files = readdirRecurse(path, { fileExtensions: ['js'] });

		for await (const file of files) {
			const info = getComponentInfo(file);
			if (!info) {
				continue;
			}

			const mod = (await import(pathToFileURL(file).toString())) as { default: ComponentConstructor };
			const component = container.resolve(mod.default);
			const name = component.name ?? info.name;

			this.components.set(name, component);
		}
	}
}
