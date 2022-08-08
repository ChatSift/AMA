import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, MessageActionRowComponentBuilder } from '@discordjs/builders';
import { PrismaClient } from '@prisma/client';
import { ButtonInteraction, Client, TextChannel, ButtonStyle } from 'discord.js';
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

		const author = await this.client.users.fetch(question.authorId).catch(() => null);
		const embed = new EmbedBuilder().setDescription(question.content).setAuthor({
			name: `${author?.tag ?? 'Unknown#0000'} (${author?.id ?? 'Unknown user ID - likely deleted'})`,
			iconURL: author?.displayAvatarURL(),
		});

		if (question.ama.guestQueue) {
			const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel('Stage')
					.setStyle(ButtonStyle.Success)
					.setCustomId(`guest-approve|${question.id}|stage`),
				new ButtonBuilder()
					.setLabel('Text')
					.setStyle(ButtonStyle.Success)
					.setCustomId(`guest-approve|${question.id}|text`),
				new ButtonBuilder().setLabel('Skip').setStyle(ButtonStyle.Danger).setCustomId(`guest-deny|${question.id}`),
			);

			const channel = (await this.client.channels
				.fetch(question.ama.guestQueue)
				.catch(() => null)) as TextChannel | null;
			if (!channel) {
				return interaction.reply({
					content: 'The guest queue channel no longer exists - please contact an admin.',
					ephemeral: true,
				});
			}

			await channel.send({
				allowedMentions: { parse: [] },
				embeds: [embed],
				components: [row],
			});
		} else {
			embed.setColor(Colors.Blurple);

			const channel = (await this.client.channels
				.fetch(question.ama.answersChannel)
				.catch(() => null)) as TextChannel | null;
			if (!channel) {
				return interaction.reply({
					content: 'The answers channel no longer exists - please contact an admin.',
					ephemeral: true,
				});
			}

			await channel.send({
				allowedMentions: { parse: [] },
				embeds: [embed],
			});
		}

		return interaction.update({ embeds: [{ ...interaction.message.embeds[0]?.toJSON(), color: Colors.Approved }] });
	}
}
