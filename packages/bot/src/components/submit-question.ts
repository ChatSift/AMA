import { ms } from '@naval-base/ms';
import { PrismaClient } from '@prisma/client';
import type { Result } from '@sapphire/result';
import type { ModalActionRowComponentBuilder, ButtonInteraction } from 'discord.js';
import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { nanoid } from 'nanoid';
import { singleton } from 'tsyringe';
import { AmaManager } from '#struct/AmaManager';
import type { Component } from '#struct/Component';
import { GracefulTransactionFailure } from '#struct/GracefulTransactionError';

@singleton()
export default class implements Component<ButtonInteraction<'cached'>> {
	public constructor(
		private readonly prisma: PrismaClient,
		private readonly amaManager: AmaManager,
	) {}

	public async handle(interaction: ButtonInteraction<'cached'>) {
		const ama = await this.prisma.ama.findFirst({ where: { promptMessageId: interaction.message.id } });

		if (!ama) {
			await interaction.reply({
				content: 'No AMA found, this is likely a bug.',
				ephemeral: true,
			});
			return;
		}

		if (ama.ended) {
			await interaction.reply({
				content: 'This AMA has already ended.',
				ephemeral: true,
			});
			return;
		}

		const id = nanoid();

		const modal = new ModalBuilder()
			.setTitle('Ask a question for the AMA')
			.setCustomId(id)
			.addComponents(
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('content')
						.setLabel('The question you want to ask')
						.setMinLength(15)
						.setMaxLength(4_000)
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
		const modalInteraction = await interaction
			.awaitModalSubmit({ time: ms('5m'), filter: (interaction) => interaction.customId === id })
			.catch(() => null);
		if (!modalInteraction) {
			return;
		}

		const content = modalInteraction.fields.getTextInputValue('content');
		const rawImageUrl = modalInteraction.fields.getTextInputValue('image-url');
		const imageUrl = rawImageUrl.length ? rawImageUrl : null;

		await modalInteraction.reply({
			content: 'Forwarding your question...',
			ephemeral: true,
		});

		const question = await this.prisma
			.$transaction(async (prisma) => {
				const amaQuestion = await prisma.amaQuestion.create({
					data: {
						amaId: ama.id,
						authorId: modalInteraction.user.id,
						content,
						imageUrl,
					},
				});

				const basePostData = {
					question: amaQuestion,
					content,
					imageUrl,
					user: modalInteraction.user,
				};

				// eslint-disable-next-line unicorn/consistent-function-scoping
				const unwrapErr = (result: Result<unknown, Error>) => {
					if (result.isErr()) {
						const err = result.unwrapErr();
						throw new GracefulTransactionFailure(err.message, { cause: err });
					}
				};

				if (ama.modQueue) {
					unwrapErr(
						await this.amaManager.postToModQueue({
							...basePostData,
							modQueue: ama.modQueue,
							flaggedQueue: ama.flaggedQueue,
						}),
					);
				} else if (ama.guestQueue) {
					unwrapErr(
						await this.amaManager.postToGuestQueue({
							...basePostData,
							guestQueue: ama.guestQueue,
						}),
					);
				} else {
					unwrapErr(
						await this.amaManager.postToAnswersChannel({
							...basePostData,
							answersChannel: ama.answersChannel,
							stage: ama.stageOnly,
						}),
					);
				}

				return amaQuestion;
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
