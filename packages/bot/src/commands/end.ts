import { ActionRowBuilder, SelectMenuBuilder, SelectMenuOptionBuilder } from '@discordjs/builders';
import { Ama, PrismaClient } from '@prisma/client';
import {
	ApplicationCommandType,
	AutocompleteInteraction,
	SelectMenuInteraction,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { singleton } from 'tsyringe';
import type { CommandBody, Command } from '#struct/Command';
import { SelectMenuPaginator, SelectMenuPaginatorConsumers } from '#struct/SelectMenuPaginator';

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		name: 'end',
		description: 'Lists ongoing AMAs',
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handleAutocomplete(interaction: AutocompleteInteraction<'cached'>) {
		const amas = await this.prisma.ama.findMany({
			where: {
				guildId: interaction.guild.id,
				ended: false,
			},
		});

		return amas.map((ama) => ({ name: String(ama.id), value: ama.id }));
	}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const amas = await this.prisma.ama.findMany({
			where: {
				guildId: interaction.guild.id,
				ended: false,
			},
		});

		if (!amas.length) {
			return interaction.reply('No ongoing AMAs.');
		}

		const paginator = new SelectMenuPaginator({
			key: 'ama-list',
			data: amas,
			maxPageLength: 40,
		});

		let content;
		const actionRow = new ActionRowBuilder<SelectMenuBuilder>();

		const updateMessagePayload = (consumers: SelectMenuPaginatorConsumers<Ama[]>) => {
			const { data, currentPage, selectMenu, pageLeftOption, pageRightOption } = consumers.asSelectMenu();
			content = `Select an AMA to end; Page ${currentPage + 1}/${paginator.pageCount}`;

			const options: SelectMenuOptionBuilder[] = [];
			if (pageLeftOption) {
				options.push(pageLeftOption);
			}

			options.push(...data.map((ama) => new SelectMenuOptionBuilder().setLabel(ama.title).setValue(String(ama.id))));

			if (pageRightOption) {
				options.push(pageRightOption);
			}

			actionRow.setComponents(selectMenu.setOptions(options).setMinValues(1).setMaxValues(1));
		};

		updateMessagePayload(paginator.getCurrentPage());

		const reply = await interaction.reply({
			content,
			components: [actionRow],
			fetchReply: true,
		});

		for await (const [component] of reply.createMessageComponentCollector({ idle: 30_000 })) {
			const isLeft = component.customId === 'page-left';
			const isRight = component.customId === 'page-right';

			if (isLeft || isRight) {
				updateMessagePayload(isLeft ? paginator.previousPage() : paginator.nextPage());
				await component.update({ content, components: [actionRow] });
				continue;
			}

			await this.prisma.ama.update({
				data: {
					ended: true,
				},
				where: {
					id: Number((component as SelectMenuInteraction).values[0]!),
				},
			});

			return interaction.editReply({ content: 'Successfully ended AMA.', components: [] });
		}

		return reply.edit({ content: 'Timed out...', components: [] });
	}
}
