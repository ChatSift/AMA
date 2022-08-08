import { PrismaClient } from '@prisma/client';
import type { ButtonInteraction } from 'discord.js';
import { singleton } from 'tsyringe';
import { Colors } from '../util/colors';
import type { Component } from '#struct/Component';

@singleton()
export default class implements Component<ButtonInteraction<'cached'>> {
	public constructor(private readonly prisma: PrismaClient) {}

	public async handle(interaction: ButtonInteraction<'cached'>, rawQuestionId: string) {
		const questionId = parseInt(rawQuestionId, 10);
		const question = await this.prisma.amaQuestion.findFirst({
			where: {
				id: questionId,
			},
			include: {
				ama: true,
			},
		});

		if (!question) {
			return interaction.reply({ content: 'No AMA found, this is likely a bug.', ephemeral: true });
		}

		if (question.ama.ended) {
			return interaction.reply({ content: 'This AMA has already ended.', ephemeral: true });
		}

		await interaction.update({ embeds: [{ ...interaction.message.embeds[0]?.toJSON(), color: Colors.Denied }] });
	}
}
