import type {
	ApplicationCommandOptionChoiceData,
	ApplicationCommandType,
	AutocompleteInteraction,
	Awaitable,
	ChatInputCommandInteraction,
	MessageContextMenuCommandInteraction,
	RESTPostAPIApplicationCommandsJSONBody,
	UserContextMenuCommandInteraction,
} from 'discord.js';

type InteractionTypeMapping = {
	[ApplicationCommandType.ChatInput]: ChatInputCommandInteraction<'cached'>;
	[ApplicationCommandType.User]: UserContextMenuCommandInteraction<'cached'>;
	[ApplicationCommandType.Message]: MessageContextMenuCommandInteraction<'cached'>;
};

export type CommandBody<Type extends ApplicationCommandType> = RESTPostAPIApplicationCommandsJSONBody & {
	type: Type;
};

export type Command<Type extends ApplicationCommandType = ApplicationCommandType> = {
	handle(interaction: InteractionTypeMapping[Type]): Awaitable<unknown>;
	handleAutocomplete?(interaction: AutocompleteInteraction<any>): Awaitable<ApplicationCommandOptionChoiceData[]>;
	readonly interactionOptions: CommandBody<Type>;
};

export type CommandConstructor = new (...args: any[]) => Command;
