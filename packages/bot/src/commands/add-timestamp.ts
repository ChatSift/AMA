import { ms } from '@naval-base/ms';
import { PrismaClient } from '@prisma/client';
import type { MessageContextMenuCommandInteraction, ModalActionRowComponentBuilder } from 'discord.js';
import {
	ActionRowBuilder,
	ApplicationCommandType,
	EmbedBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
} from 'discord.js';
import { nanoid } from 'nanoid';
import { singleton } from 'tsyringe';
import type { Command, CommandBody } from '../struct/Command';

@singleton()
export default class implements Command<ApplicationCommandType.Message> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.Message> = {
		name: 'Add Timestamp',
		type: ApplicationCommandType.Message,
		default_member_permissions: '0',
		dm_permission: false,
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handle(interaction: MessageContextMenuCommandInteraction<'cached'>) {
		const question = await this.prisma.amaQuestion.findFirst({
			where: {
				answerMessageId: interaction.targetId,
			},
		});

		if (!question) {
			return interaction.reply({
				content: 'This message is not an AMA question.',
				ephemeral: true,
			});
		}

		const id = nanoid();

		const modal = new ModalBuilder()
			.setTitle('Indicate when the question was answered')
			.setCustomId(id)
			.addComponents(
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('text')
						.setLabel('(Text) Visual representation of the timestamp')
						.setPlaceholder('e.g. 1:23:45')
						.setMinLength(1)
						.setMaxLength(20)
						.setStyle(TextInputStyle.Short)
						.setRequired(true),
				),
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('url')
						.setLabel('(Optional) Link for the timestamp')
						.setPlaceholder('e.g. https://youtu.be/Siqi_yunMV0')
						.setStyle(TextInputStyle.Short)
						.setRequired(false),
				),
			);

		await interaction.showModal(modal);
		const modalInteraction = await interaction
			.awaitModalSubmit({ time: ms('5m'), filter: (interaction) => interaction.customId === id })
			.catch(() => null);

		if (!modalInteraction) {
			return;
		}

		const text = modalInteraction.fields.getTextInputValue('text');
		const url = modalInteraction.fields.getTextInputValue('url');

		const answeredAt = url.length ? `[[${text}](${url})]` : `[${text}]`;

		const [toUpdate, ...rest] = interaction.targetMessage.embeds;
		const updated = new EmbedBuilder(toUpdate!.toJSON()).setDescription(`${answeredAt} ${toUpdate!.description}`);

		await interaction.targetMessage.edit({
			embeds: [updated, ...rest],
		});

		await modalInteraction.reply({
			content: 'Timestamp added!',
			ephemeral: true,
		});
	}
}
