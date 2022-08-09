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
import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ButtonStyle,
	ChannelType,
	TextInputStyle,
	type ChatInputCommandInteraction,
} from 'discord.js';
import { singleton } from 'tsyringe';
import type { CommandBody, Command } from '#struct/Command';
import { Colors } from '#util/colors';

const allowedChannelTypes: Exclude<ChannelType, ChannelType.DM | ChannelType.GroupDM>[] = [
	ChannelType.GuildText,
	ChannelType.GuildNewsThread,
	ChannelType.GuildPublicThread,
	ChannelType.GuildPrivateThread,
];

@singleton()
export default class implements Command<ApplicationCommandType.ChatInput> {
	public readonly interactionOptions: CommandBody<ApplicationCommandType.ChatInput> = {
		name: 'start',
		description: 'Starts an AMA session',
		type: ApplicationCommandType.ChatInput,
		default_member_permissions: '0',
		dm_permission: false,
		options: [
			{
				name: 'answers-channel',
				description: 'Channel to use for answers',
				type: ApplicationCommandOptionType.Channel,
				channel_types: allowedChannelTypes,
				required: true,
			},
			{
				name: 'mod-queue',
				description: 'Channel to use for the mod queue',
				type: ApplicationCommandOptionType.Channel,
				channel_types: allowedChannelTypes,
			},
			{
				name: 'flagged-queue',
				description: 'Channel to use for flagged messages',
				type: ApplicationCommandOptionType.Channel,
				channel_types: allowedChannelTypes,
			},
			{
				name: 'guest-queue',
				description: 'Channel to use for the guest queue',
				type: ApplicationCommandOptionType.Channel,
				channel_types: allowedChannelTypes,
			},
			{
				name: 'stage-only',
				description: 'Whether this is a stage only AMA - only available when none of the optional queues are specified',
				type: ApplicationCommandOptionType.Boolean,
			},
		],
	};

	public constructor(private readonly prisma: PrismaClient) {}

	public async handle(interaction: ChatInputCommandInteraction<'cached'>) {
		const modQueue = interaction.options.getChannel('mod-queue')?.id;
		const flaggedQueue = interaction.options.getChannel('flagged-queue')?.id;
		const guestQueue = interaction.options.getChannel('guest-queue')?.id;
		const answersChannel = interaction.options.getChannel('answers-channel', true).id;
		const stageOnly = interaction.options.getBoolean('stage-only') ?? false;

		if (stageOnly && (modQueue || flaggedQueue || guestQueue)) {
			return interaction.reply('You cannot specify a stage only AMA with any of the optional queues');
		}

		if (!modQueue && flaggedQueue) {
			return interaction.reply('You cannot specify a flagged queue without a mod queue');
		}

		const modal = new ModalBuilder()
			.setTitle('Start an AMA session')
			.setCustomId('modal')
			.addComponents(
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('title')
						.setLabel('Title of your AMA')
						.setPlaceholder('AMA with renowed JP VA John Doe')
						.setMinLength(1)
						.setMaxLength(1000)
						.setStyle(TextInputStyle.Short)
						.setRequired(true),
				),
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('description')
						.setLabel('Optional brief description of your AMA/guest')
						.setPlaceholder('John Doe debut in 2010, he is currently voicing in the hit series "Morbius: The Return"')
						.setMaxLength(4000)
						.setStyle(TextInputStyle.Paragraph)
						.setRequired(false),
				),
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('plain-text')
						.setLabel('Optional plain text outside of the embed - use this for pings')
						.setPlaceholder('You might need to do something like <@&123456789> to actually ping')
						.setMaxLength(100)
						.setStyle(TextInputStyle.Paragraph)
						.setRequired(false),
				),
				new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
					new TextInputBuilder()
						.setCustomId('image-url')
						.setLabel('Optional image URL to use')
						.setStyle(TextInputStyle.Short)
						.setRequired(false),
				),
			);

		await interaction.showModal(modal);
		const modalInteraction = await interaction.awaitModalSubmit({ time: ms('5m') }).catch(() => null);
		if (!modalInteraction) {
			return;
		}

		await modalInteraction.reply({ content: 'Creating AMA session...', ephemeral: true });

		const title = modalInteraction.fields.getTextInputValue('title');
		const plainText = modalInteraction.fields.getTextInputValue('plain-text');
		const description = modalInteraction.fields.getTextInputValue('description');
		const imageUrl = modalInteraction.fields.getTextInputValue('image-url');

		const promptMessage = await interaction.channel!.send({
			content: plainText.length ? plainText : undefined,
			embeds: [
				new EmbedBuilder()
					.setColor(Colors.Blurple)
					.setTitle(title)
					.setDescription(description.length ? description : null)
					.setImage(imageUrl.length ? imageUrl : null),
			],
			components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
					new ButtonBuilder()
						.setCustomId('submit-question')
						.setLabel('Submit a question')
						.setStyle(ButtonStyle.Primary),
				),
			],
		});

		await this.prisma.ama.create({
			data: {
				guildId: interaction.guildId,
				modQueue,
				flaggedQueue,
				guestQueue,
				answersChannel,
				stageOnly,
				promptChannelId: interaction.channel!.id,
				promptMessageId: promptMessage.id,
			},
		});
	}
}
