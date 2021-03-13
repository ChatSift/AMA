import { createAmqp, RoutingClient } from '@cordis/brokers';
import { container } from 'tsyringe';
import { Settings, Ama, AmaQuestion, Config, kConfig, kRest, kSQL } from '@ama/common';
import { COMMANDS, UserPermissions } from './Command';
import { parseInteraction } from './parser';
import { memberPermissions, send } from './util';
import { Args } from 'lexure';
import {
  APIInteraction,
  APIInteractionResponseType,
  APIMessage,
  GatewayDispatchEvents,
  GatewayMessageReactionAddDispatch,
  RESTPatchAPIChannelMessageJSONBody,
  RESTPatchAPIChannelMessageResult,
  RESTPostAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageResult,
  Routes
} from 'discord-api-types/v8';
import { EMOJI } from './util/Emoji';
import { RestManager } from '@cordis/rest';
import type { DiscordEvents } from '@cordis/common';
import type { Sql } from 'postgres';

type SqlNoop<T> = { [K in keyof T]: T[K] };

const interactionCreate = async (interaction: Required<APIInteraction>) => {
  const parsed = parseInteraction(interaction.data.options ?? []);
  const command = COMMANDS.get(interaction.data.name);

  if (command) {
    try {
      if (command.userPermissions) {
        const memberPerms = await memberPermissions(interaction);
        if (memberPerms < command.userPermissions) {
          throw new Error(`Missing permission to run that command. You should be at least \`${UserPermissions[command.userPermissions]}\``);
        }
      }

      return await command.exec(interaction, new Args(parsed));
    } catch (e) {
      return send(interaction, { content: e.message, flags: 64 }, APIInteractionResponseType.ChannelMessageWithSource);
    }
  }
};

const messageReactionAdd = async (reaction: GatewayMessageReactionAddDispatch['d']) => {
  const sql = container.resolve<Sql<{}>>(kSQL);
  const rest = container.resolve<RestManager>(kRest);

  if (!reaction.guild_id || !reaction.emoji.name || !(Object.values(EMOJI) as string[]).includes(reaction.emoji.name)) return null;

  const [data] = await sql<[SqlNoop<Settings & Ama & AmaQuestion>?]>`
    SELECT * FROM ama_questions

    INNER JOIN settings
    ON settings.guild_id = amas.guild_id

    INNER JOIN amas
    ON ama_questions.ama_id = amas.id

    WHERE amas.ended = false
      AND amas.guild_id = ${reaction.guild_id}
      AND amas.answers_channel = ${reaction.channel_id}
      AND (ama_questions.mod_queue_message_id = ${reaction.message_id} OR ama_questions.guest_queue_message_id = ${reaction.message_id})
  `;

  if (!data) return null;

  switch (reaction.emoji.name) {
    case EMOJI.APPROVE: {
      const isInGuestQueue = Boolean(data.guest_queue_message_id);

      const existingMessageChannelId = isInGuestQueue ? data.guest_queue! : data.mod_queue!;
      const existingMessageId = isInGuestQueue ? data.guest_queue_message_id! : data.mod_queue_message_id;
      const existingMessage = await rest
        .get<APIMessage, never>(Routes.channelMessage(existingMessageChannelId, existingMessageId))
        .catch(() => null);

      if (!existingMessage) return null;

      // TODO: Wait for cordis 0.1.7
      // @ts-ignore
      await rest.patch<RESTPatchAPIChannelMessageResult, RESTPatchAPIChannelMessageJSONBody>(
        Routes.channelMessage(existingMessageChannelId, existingMessageId), {
          data: {
            embed: {
              color: '8450847',
              ...existingMessage.embeds[0]
            }
          }
        }
      )
        .catch(() => null);

      const newMessageChannelId = isInGuestQueue ? data.answers_channel : data.guest_queue!;

      // TODO: Wait for cordis 0.1.7
      // @ts-ignore
      const newMessage = await rest.post<RESTPostAPIChannelMessageResult, RESTPostAPIChannelMessageJSONBody>(
        Routes.channelMessages(newMessageChannelId),
        { data: existingMessage }
      );

      if (!isInGuestQueue) data.guest_queue_message_id = newMessage.id;

      await sql`UPDATE ama_questions SET ${sql(data)}`;

      break;
    }
  }
};

export const makeGateway = async () => {
  const config = container.resolve<Config>(kConfig);

  const { channel } = await createAmqp(config.amqpUrl);
  const gateway = new RoutingClient<keyof DiscordEvents, DiscordEvents>(channel);

  gateway
    .on(GatewayDispatchEvents.InteractionCreate, interactionCreate)
    .on(GatewayDispatchEvents.MessageReactionAdd, messageReactionAdd);

  return gateway;
};
