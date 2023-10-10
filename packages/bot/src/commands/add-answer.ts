import { ms } from '@naval-base/ms';
import { PrismaClient } from '@prisma/client';
import type { Embed, MessageContextMenuCommandInteraction, ModalActionRowComponentBuilder } from 'discord.js';
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
import type { Command, CommandBody } from '../struct/Command.js';
import { Colors } from '../util/colors.js';

@singleton()
export default class implements Command<ApplicationCommandType.Message> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.Message> = {
		name: 'Add Answer',
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
			.setTitle('Add an answer')
			.setCustomId(id)
			.addComponents(
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('answer')
						.setLabel('Answer to the question')
						.setPlaceholder('Yes! I love ramen!')
						.setMinLength(2)
						.setMaxLength(4_000)
						.setStyle(TextInputStyle.Paragraph)
						.setRequired(true),
				),
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('image-url')
						.setLabel('(Optional) Image URL to use')
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

		const text = modalInteraction.fields.getTextInputValue('answer');
		const imageUrl = modalInteraction.fields.getTextInputValue('image-url');

		const embeds: (Embed | EmbedBuilder)[] = interaction.targetMessage.embeds;
		const answerEmbed = new EmbedBuilder()
			.setDescription(text)
			.setImage(imageUrl.length ? imageUrl : null)
			.setAuthor({
				name: `${interaction.user.tag} (${interaction.user.id})`,
				iconURL: interaction.user.displayAvatarURL(),
			})
			.setColor(Colors.Blurple);

		if (embeds.length >= 2) {
			embeds.splice(1, 1, answerEmbed);
		} else {
			embeds.push(answerEmbed);
		}

		await interaction.targetMessage.edit({
			embeds,
		});

		await modalInteraction.reply({
			content: 'Answer added!',
			ephemeral: true,
		});
	}
}
