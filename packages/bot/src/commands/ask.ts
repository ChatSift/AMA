import type {
	ModalActionRowComponentBuilder,
	SelectMenuBuilder,
} from "@discordjs/builders";
import {
	ActionRowBuilder,
	ModalBuilder,
	SelectMenuOptionBuilder,
	TextInputBuilder,
} from "@discordjs/builders";
import { ms } from "@naval-base/ms";
import type { Ama } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import type { Result } from "@sapphire/result";
import type { SelectMenuInteraction } from "discord.js";
import {
	ApplicationCommandType,
	TextInputStyle,
	type ChatInputCommandInteraction,
} from "discord.js";
import { singleton } from "tsyringe";
import { GracefulTransactionFailure } from "../struct/GracefulTransactionError";
import { AmaManager } from "#struct/AmaManager";
import type { CommandBody, Command } from "#struct/Command";
import type { SelectMenuPaginatorConsumers } from "#struct/SelectMenuPaginator";
import { SelectMenuPaginator } from "#struct/SelectMenuPaginator";

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		name: "ask",
		description: "Asks a question",
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: "0",
		dm_permission: false,
	};

	public constructor(private readonly prisma: PrismaClient, private readonly amaManager: AmaManager) {}

	private async prompt(interaction: ChatInputCommandInteraction<"cached"> | SelectMenuInteraction<"cached">, ama: Ama) {
		const modal = new ModalBuilder()
			.setTitle("Ask a question for the AMA")
			.setCustomId("modal")
			.addComponents(
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId("content")
						.setLabel("The question you want to ask")
						.setMinLength(15)
						.setMaxLength(4_000)
						.setStyle(TextInputStyle.Paragraph)
						.setRequired(true),
				),
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId("image-url")
						.setLabel("Optional image URL to display")
						.setStyle(TextInputStyle.Short)
						.setRequired(false),
				),
			);

		await interaction.showModal(modal);
		const modalInteraction = await interaction.awaitModalSubmit({ time: ms("5m") }).catch(() => null);
		if (!modalInteraction) {
			return;
		}

		const content = modalInteraction.fields.getTextInputValue("content");
		const rawImageUrl = modalInteraction.fields.getTextInputValue("image-url");
		const imageUrl = rawImageUrl.length ? rawImageUrl : null;

		await modalInteraction.reply({
			content: "Forwarding your question...",
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

		await modalInteraction.editReply({ content: "Question sent!" });
	}

	public async handle(interaction: ChatInputCommandInteraction<"cached">) {
		const amas = await this.prisma.ama.findMany({
			where: {
				guildId: interaction.guild.id,
				ended: false,
			},
		});

		if (!amas.length) {
			return interaction.reply({
				content: "No ongoing AMAs.",
				ephemeral: true,
			});
		}

		if (amas.length > 1) {
			const paginator = new SelectMenuPaginator({
				key: "ama-list",
				data: amas,
				maxPageLength: 40,
			});

			let content;
			const actionRow = new ActionRowBuilder<SelectMenuBuilder>();

			const updateMessagePayload = (consumers: SelectMenuPaginatorConsumers<Ama[]>) => {
				const { data, currentPage, selectMenu, pageLeftOption, pageRightOption } = consumers.asSelectMenu();
				content = `Select an AMA; Page ${currentPage + 1}/${paginator.pageCount}`;

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
				ephemeral: true,
			});

			for await (const [component] of reply.createMessageComponentCollector({ idle: 30_000 })) {
				const isLeft = component.customId === "page-left";
				const isRight = component.customId === "page-right";

				if (isLeft || isRight) {
					updateMessagePayload(isLeft ? paginator.previousPage() : paginator.nextPage());
					await component.update({
						content,
						components: [actionRow],
					});
					continue;
				}

				// eslint-disable-next-line no-extra-parens
				const ama = amas.find((a) => a.id === Number.parseInt((component as SelectMenuInteraction).values[0]!, 10))!;
				return this.prompt(component as SelectMenuInteraction<"cached">, ama);
			}

			return reply.edit({
				content: "Timed out...",
				components: [],
			});
		}

		return this.prompt(interaction, amas[0]!);
	}
}
