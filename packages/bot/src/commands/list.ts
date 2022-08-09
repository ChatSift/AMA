import { PrismaClient } from '@prisma/client';
import { ApplicationCommandType, type ChatInputCommandInteraction } from 'discord.js';
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
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const amas = await this.prisma.ama.findMany({
			where: {
				guildId: interaction.guild.id,
				ended: false,
			},
		});

		if (!amas.length) {
			return interaction.reply({ content: 'No ongoing AMAs.' });
		}

		const formatted = amas.map(
			(ama) =>
				`• AMA #${ama.id}; URL to prompt: https://discord.com/channels/${interaction.guild.id}/${ama.promptChannelId}/${ama.promptMessageId}`,
		);

		return interaction.reply({ content: formatted.join('\n') });
	}
}
