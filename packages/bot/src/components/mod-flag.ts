import { EmbedBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import { ButtonInteraction, Client, TextChannel } from 'discord.js';
import { singleton } from 'tsyringe';
import { Colors } from '../util/colors';
import type { Component } from '#struct/Component';

@singleton()
export default class implements Component<ButtonInteraction<'cached'>> {
	public constructor(private readonly prisma: PrismaClient, private readonly client: Client) {}

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

		if (!question.ama.flaggedQueue) {
			return interaction.reply({ content: 'This AMA has no flag queue, this is likely a bug.', ephemeral: true });
		}

		const channel = (await this.client.channels
			.fetch(question.ama.flaggedQueue)
			.catch(() => null)) as TextChannel | null;
		if (!channel) {
			return interaction.reply({
				content: 'The flagged queue channel no longer exists - please contact an admin.',
				ephemeral: true,
			});
		}

		const author = await this.client.users.fetch(question.authorId).catch(() => null);
		const embed = new EmbedBuilder()
			.setDescription(question.content)
			.setAuthor({
				name: `${author?.tag ?? 'Unknown#0000'} (${author?.id ?? 'Unknown user ID - likely deleted'})`,
				iconURL: author?.displayAvatarURL(),
			})
			.setColor(Colors.Flagged);

		await channel.send({
			allowedMentions: { parse: [] },
			embeds: [embed],
		});
		await interaction.update({ embeds: [{ ...interaction.message.embeds[0]?.toJSON(), color: Colors.Flagged }] });
	}
}
