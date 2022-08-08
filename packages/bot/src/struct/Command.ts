import {
	ApplicationCommandOptionChoiceData,
	ApplicationCommandType,
	AutocompleteInteraction,
	Awaitable,
	ChatInputCommandInteraction,
	MessageContextMenuCommandInteraction,
	RESTPostAPIApplicationCommandsJSONBody,
	UserContextMenuCommandInteraction,
} from 'discord.js';

interface InteractionTypeMapping {
	[ApplicationCommandType.ChatInput]: ChatInputCommandInteraction<'cached'>;
	[ApplicationCommandType.User]: UserContextMenuCommandInteraction<'cached'>;
	[ApplicationCommandType.Message]: MessageContextMenuCommandInteraction<'cached'>;
}

export type CommandBody<Type extends ApplicationCommandType> = RESTPostAPIApplicationCommandsJSONBody & {
	type: Type;
};

export interface Command<Type extends ApplicationCommandType = ApplicationCommandType> {
	readonly interactionOptions: CommandBody<Type>;
	handleAutocomplete?: (interaction: AutocompleteInteraction<any>) => Awaitable<ApplicationCommandOptionChoiceData[]>;
	handle: (interaction: InteractionTypeMapping[Type]) => Awaitable<unknown>;
}

export type CommandConstructor = new (...args: any[]) => Command;
