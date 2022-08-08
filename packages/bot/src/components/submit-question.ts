import {
	ActionRowBuilder,
	ButtonBuilder,
	EmbedBuilder,
	MessageActionRowComponentBuilder,
	ModalActionRowComponentBuilder,
	ModalBuilder,
	TextInputBuilder,
} from '@discordjs/builders';
import { ms } from '@naval-base/ms';
import { PrismaClient } from '@prisma/client';
import { ButtonInteraction, TextInputStyle, Client, TextChannel, ButtonStyle } from 'discord.js';
import { singleton } from 'tsyringe';
import { Colors } from '../util/colors';
import type { Component } from '#struct/Component';
import { GracefulTransactionFailure } from '#struct/GracefulTransactionError';

@singleton()
export default class implements Component<ButtonInteraction<'cached'>> {
	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

	public async handle(interaction: ButtonInteraction<'cached'>) {
		const ama = await this.prisma.ama.findFirst({
			where: {
				promptMessageId: interaction.message.id,
			},
		});

		if (!ama) {
			return interaction.reply({ content: 'No AMA found, this is likely a bug.', ephemeral: true });
		}

		if (ama.ended) {
			return interaction.reply({ content: 'This AMA has already ended.', ephemeral: true });
		}

		const modal = new ModalBuilder()
			.setTitle('Ask a question for the AMA')
			.setCustomId('modal')
			.addComponents(
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('content')
						.setLabel('The question you want to ask')
						.setMinLength(15)
						.setMaxLength(4000)
						.setStyle(TextInputStyle.Paragraph)
						.setRequired(true),
				),
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('image-url')
						.setLabel('Optional image URL to display')
						.setStyle(TextInputStyle.Short)
						.setRequired(false),
				),
			);

		await interaction.showModal(modal);
		const modalInteraction = await interaction.awaitModalSubmit({ time: ms('5m') }).catch(() => null);
		if (!modalInteraction) {
			return;
		}

		const content = modalInteraction.fields.getTextInputValue('content');
		const imageUrl = modalInteraction.fields.getTextInputValue('image-url');

		await modalInteraction.reply({ content: 'Forwarding your question...', ephemeral: true });
		const embed = new EmbedBuilder().setDescription(content).setAuthor({
			name: `${modalInteraction.user.tag} (${modalInteraction.user.id})`,
			iconURL: modalInteraction.user.displayAvatarURL(),
		});

		const question = await this.prisma
			.$transaction(async (prisma) => {
				const question = await prisma.amaQuestion.create({
					data: {
						amaId: ama.id,
						authorId: modalInteraction.user.id,
						content,
						imageUrl: imageUrl.length ? imageUrl : null,
					},
				});

				const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new ButtonBuilder()
						.setLabel('Approve')
						.setStyle(ButtonStyle.Success)
						.setCustomId(`mod-approve|${question.id}`),
					new ButtonBuilder().setLabel('Deny').setStyle(ButtonStyle.Danger).setCustomId(`mod-deny|${question.id}`),
				);

				if (ama.modQueue) {
					const channel = (await this.client.channels.fetch(ama.modQueue).catch(() => null)) as TextChannel | null;
					if (!channel) {
						throw new GracefulTransactionFailure('The mod queue channel no longer exists - please contact an admin.');
					}

					if (ama.flaggedQueue) {
						row.addComponents(
							new ButtonBuilder()
								.setLabel('Flag')
								.setStyle(ButtonStyle.Secondary)
								.setCustomId(`mod-flag|${question.id}`)
								.setEmoji({ name: '⚠️' }),
						);
					}

					await channel.send({
						allowedMentions: { parse: [] },
						embeds: [embed],
						components: [row],
					});
				} else if (ama.guestQueue) {
					const channel = (await this.client.channels.fetch(ama.guestQueue).catch(() => null)) as TextChannel | null;
					if (!channel) {
						throw new GracefulTransactionFailure('The guest queue channel no longer exists - please contact an admin.');
					}

					await channel.send({
						allowedMentions: { parse: [] },
						embeds: [embed],
						components: [row],
					});
				} else {
					embed.setColor(Colors.Blurple);
					if (ama.stageOnly) {
						embed.setFooter({
							text: 'This question was answered via stage',
						});
					}

					const channel = (await this.client.channels
						.fetch(ama.answersChannel)
						.catch(() => null)) as TextChannel | null;
					if (!channel) {
						throw new GracefulTransactionFailure('The answers channel no longer exists - please contact an admin.');
					}

					await channel.send({
						allowedMentions: { parse: [] },
						embeds: [embed],
					});
				}

				return question;
			})
			.catch(async (error) => {
				if (error instanceof GracefulTransactionFailure) {
					await modalInteraction.editReply({ content: error.message });
					return null;
				}

				throw error;
			});

		if (!question) {
			return;
		}

		await modalInteraction.editReply({ content: 'Question sent!' });
	}
}
