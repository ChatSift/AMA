import { PrismaClient } from '@prisma/client';
import type { ButtonInteraction } from 'discord.js';
import { Client } from 'discord.js';
import { singleton } from 'tsyringe';
import { AmaManager } from '#struct/AmaManager';
import type { Component } from '#struct/Component';
import { Colors } from '#util/colors';

@singleton()
export default class implements Component<ButtonInteraction<'cached'>> {
	public constructor(
		private readonly prisma: PrismaClient,
		private readonly client: Client,
		private readonly amaManager: AmaManager,
	) {}

	public async handle(interaction: ButtonInteraction<'cached'>, rawQuestionId: string, mode: 'stage' | 'text') {
		const questionId = Number.parseInt(rawQuestionId, 10);
		const question = await this.prisma.amaQuestion.findFirst({
			where: { id: questionId },
			include: { ama: true },
		});

		if (!question) {
			return interaction.reply({
				content: 'No AMA found, this is likely a bug.',
				ephemeral: true,
			});
		}

		if (question.ama.ended) {
			return interaction.reply({
				content: 'This AMA has already ended.',
				ephemeral: true,
			});
		}

		const user = await this.client.users.fetch(question.authorId).catch(() => null);
		const result = await this.amaManager.postToAnswersChannel({
			content: question.content,
			imageUrl: question.imageUrl,
			user,
			question,
			answersChannel: question.ama.answersChannel,
			stage: mode === 'stage',
		});

		if (result.isErr()) {
			return interaction.reply({
				content: result.unwrapErr().message,
				ephemeral: true,
			});
		}

		return interaction.update({
			embeds: [
				{
					...interaction.message.embeds[0]?.toJSON(),
					color: Colors.Approved,
				},
			],
		});
	}
}
