import { PrismaClient } from '@prisma/client';
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	AutocompleteInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { singleton } from 'tsyringe';
import type { CommandBody, Command } from '#struct/Command';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		name: 'list',
		description: 'Lists ongoing AMAs',
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				name: 'id',
				description: 'ID of the AMA to end',
				type: ApplicationCommandOptionType.Integer,
				required: true,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handleAutocomplete(interaction: AutocompleteInteraction<'cached'>) {
		const amas = await this.prisma.ama.findMany({
			where: {
				guildId: interaction.guild.id,
				ended: false,
			},
		});

		return amas.map((ama) => ({ name: String(ama.id), value: ama.id }));
	}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const id = interaction.options.getInteger('id', true);
		const ama = await this.prisma.ama.findFirst({
			where: {
				id,
				guildId: interaction.guild.id,
			},
		});

		if (!ama) {
			return interaction.reply('No ongoing AMA found with that ID');
		}

		if (ama.ended) {
			return interaction.reply('This AMA has already ended');
		}

		await this.prisma.ama.update({
			where: { id },
			data: { ended: true },
		});

		return interaction.reply(`Ended AMA ${id}`);
	}
}
