import type { AmaQuestion } from '@prisma/client';
import { Result } from '@sapphire/result';
import type { MessageActionRowComponentBuilder, TextChannel, User } from 'discord.js';
import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle, Client, Colors } from 'discord.js';
import { singleton } from 'tsyringe';

export interface EmbedData {
	content: string;
	imageUrl?: string | null;
	user?: User | null;
}

export type PostData = EmbedData & {
	question: AmaQuestion;
};

export type PostToModQueueData = PostData & {
	flaggedQueue: string | null;
	modQueue: string;
};

export type PostToFlaggedQueueData = PostData & {
	flaggedQueue: string;
};

export type PostToGuestQueueData = PostData & {
	guestQueue: string;
};

export type PostToAnswerChannelData = PostData & {
	answersChannel: string;
	/**
	 * @deprecated We no longer distinguish between stage and non-stage answers/AMAs
	 */
	stage: boolean;
};

@singleton()
export class AmaManager {
	public constructor(private readonly client: Client) {}

	private getBaseEmbed({ content, imageUrl, user }: EmbedData): EmbedBuilder {
		return new EmbedBuilder()
			.setDescription(content)
			.setImage(imageUrl ?? null)
			.setAuthor({
				name: `${user?.tag ?? 'Unknown#0000'} (${user?.id ?? 'Unknown - likely deleted user'})`,
				iconURL: user?.displayAvatarURL(),
			});
	}

	public async postToModQueue({
		question,
		modQueue,
		flaggedQueue,
		...embedData
	}: PostToModQueueData): Promise<Result<unknown, Error>> {
		const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
			new ButtonBuilder().setLabel('Approve').setStyle(ButtonStyle.Success).setCustomId(`mod-approve|${question.id}`),
			new ButtonBuilder().setLabel('Deny').setStyle(ButtonStyle.Danger).setCustomId(`mod-deny|${question.id}`),
		);

		const channel = (await this.client.channels.fetch(modQueue).catch(() => null)) as TextChannel | null;
		if (!channel) {
			return Result.err(new Error('The mod queue channel no longer exists - please contact an admin.'));
		}

		if (flaggedQueue) {
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
			embeds: [this.getBaseEmbed(embedData)],
			components: [row],
		});

		return Result.ok();
	}

	public async postToFlaggedQueue({
		question,
		flaggedQueue,
		...embedData
	}: PostToFlaggedQueueData): Promise<Result<unknown, Error>> {
		const channel = (await this.client.channels.fetch(flaggedQueue).catch(() => null)) as TextChannel | null;
		if (!channel) {
			return Result.err(new Error('The flagged queue channel no longer exists - please contact an admin.'));
		}

		await channel.send({
			allowedMentions: { parse: [] },
			embeds: [this.getBaseEmbed(embedData)],
		});

		return Result.ok();
	}

	public async postToGuestQueue({
		question,
		guestQueue,
		...embedData
	}: PostToGuestQueueData): Promise<Result<unknown, Error>> {
		const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
			new ButtonBuilder().setLabel('Answer').setStyle(ButtonStyle.Success).setCustomId(`guest-approve|${question.id}`),
			new ButtonBuilder().setLabel('Skip').setStyle(ButtonStyle.Danger).setCustomId(`guest-deny|${question.id}`),
		);

		const channel = (await this.client.channels.fetch(guestQueue).catch(() => null)) as TextChannel | null;
		if (!channel) {
			return Result.err(new Error('The guest queue channel no longer exists - please contact an admin.'));
		}

		await channel.send({
			allowedMentions: { parse: [] },
			embeds: [this.getBaseEmbed(embedData)],
			components: [row],
		});

		return Result.ok();
	}

	public async postToAnswersChannel({
		question,
		stage,
		answersChannel,
		...embedData
	}: PostToAnswerChannelData): Promise<Result<unknown, Error>> {
		const embed = this.getBaseEmbed(embedData);
		embed.setColor(Colors.Blurple);

		// This is deprecated
		if (stage) {
			embed.setFooter({ text: 'This question was answered via stage' });
		}

		const channel = (await this.client.channels.fetch(answersChannel).catch(() => null)) as TextChannel | null;
		if (!channel) {
			return Result.err(new Error('The answers channel no longer exists - please contact an admin.'));
		}

		await channel.send({
			allowedMentions: { parse: [] },
			embeds: [embed],
		});

		return Result.ok();
	}
}
