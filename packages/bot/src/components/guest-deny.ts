import { PrismaClient } from "@prisma/client";
import type { ButtonInteraction } from "discord.js";
import { singleton } from "tsyringe";
import type { Component } from "#struct/Component";
import { Colors } from "#util/colors";

@singleton()
export default class implements Component<ButtonInteraction<"cached">> {
	public constructor(private readonly prisma: PrismaClient) {}

	public async handle(interaction: ButtonInteraction<"cached">, rawQuestionId: string) {
		const questionId = Number.parseInt(rawQuestionId, 10);
		const question = await this.prisma.amaQuestion.findFirst({
			where: { id: questionId },
			include: { ama: true },
		});

		if (!question) {
			await interaction.reply({
				content: "No AMA found, this is likely a bug.",
				ephemeral: true,
			});
			return;
		}

		if (question.ama.ended) {
			await interaction.reply({
				content: "This AMA has already ended.",
				ephemeral: true,
			});
			return;
		}

		await interaction.update({
			embeds: [
				{
					...interaction.message.embeds[0]?.toJSON(),
					color: Colors.Denied,
				},
			],
		});
	}
}
