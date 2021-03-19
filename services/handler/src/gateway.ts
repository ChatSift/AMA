import { createAmqp, RoutingClient } from '@cordis/brokers';
import { container } from 'tsyringe';
import { Settings, Ama, AmaQuestion, Config, kConfig, kSQL, kRest, kLogger } from '@ama/common';
import { COMMANDS, UserPermissions } from './Command';
import { parseInteraction } from './parser';
import { memberPermissions, rest, send, EMOJI, COLORS, FlowControlError } from './util';
import { Args } from 'lexure';
import {
  APIInteraction,
  GatewayDispatchEvents,
  GatewayMessageReactionAddDispatch,
  Routes
} from 'discord-api-types';
import type { DiscordEvents } from '@cordis/common';
import type { Sql } from 'postgres';
import type { Rest } from '@cordis/rest';
import type { Logger } from 'winston';

type SqlNoop<T> = { [K in keyof T]: T[K] };

const interactionCreate = async (interaction: Required<APIInteraction>) => {
  const parsed = parseInteraction(interaction.data.options ?? []);
  const command = COMMANDS.get(interaction.data.name);

  if (!command) return null;

  if (command.userPermissions && (await memberPermissions(interaction.guild_id, interaction.member) < command.userPermissions)) {
    throw new FlowControlError(
      `Missing permission to run that command. You should be at least \`${UserPermissions[command.userPermissions]}\``
    );
  }

  try {
    await command.exec(interaction, new Args(parsed));
  } catch (e) {
    const logger = container.resolve<Logger>(kLogger);
    const internal = !(e instanceof FlowControlError);

    if (internal) logger.error(e.message ?? e.toString(), { topic: 'COMMAND ERROR', guildId: interaction.guild_id, ...e });

    return send(
      interaction, {
        content: internal
          ? `Something went wrong internally! You should never see an error message like this, please contact a developer.\n${e.message}`
          : e.message,
        flags: 64
      }
    )
      .catch(e => logger.error(e.message ?? e.toString(), { topic: 'COMMAND ERROR HANDLING ERROR', guildId: interaction.guild_id, ...e }));
  }
};

const messageReactionAdd = async (reaction: GatewayMessageReactionAddDispatch['d']) => {
  const sql = container.resolve<Sql<{}>>(kSQL);
  const logger = container.resolve<Logger>(kLogger);

  if (
    !reaction.guild_id ||
    reaction.member!.user!.bot ||
    !reaction.emoji.name ||
    !(Object.values(EMOJI) as string[]).includes(reaction.emoji.name)
  ) return null;

  const [data] = await sql<[SqlNoop<Settings & Ama & AmaQuestion>?]>`
    SELECT * FROM ama_questions

    INNER JOIN amas
    ON ama_questions.ama_id = amas.id

    INNER JOIN settings
    ON settings.guild_id = amas.guild_id

    WHERE amas.ended = false
      AND amas.guild_id = ${reaction.guild_id}
      AND (ama_questions.mod_queue_message_id = ${reaction.message_id} OR ama_questions.guest_queue_message_id = ${reaction.message_id})
  `;

  if (!data) return null;

  // Used for later so we don't have to re-compute
  let isInGuestQueue = false;

  // Check if we're in mod queue first. If so make sure person reacting is a guest
  // Otherwise, if we're in mod queue, check if the person reacting is a mod or above
  // If neither, exit

  const isMod = await memberPermissions(reaction.guild_id, reaction.member!, data) > UserPermissions.mod;

  if (data.guest_queue_message_id === reaction.message_id) {
    if (!reaction.member!.roles.includes(data.guest_role_id)) return null;
    isInGuestQueue = true;
  } else if (data.mod_queue_message_id === reaction.message_id) {
    if (!isMod) return null;
  } else {
    return null;
  }

  const existingMessageChannelId = isInGuestQueue ? data.guest_queue! : data.mod_queue!;
  const existingMessageId = isInGuestQueue ? data.guest_queue_message_id! : data.mod_queue_message_id;
  const existingMessage = await rest
    .fetchChannelMessage(existingMessageChannelId, existingMessageId)
    .catch(e => void logger.error(
      `Failed to retrieve "existingMessage" ${existingMessageId} in channel ${existingMessageChannelId}`,
      { topic: 'REACTION HANDLING ERROR', guildId: reaction.guild_id, ...e }
    ));

  if (!existingMessage) return null;

  switch (reaction.emoji.name) {
    case EMOJI.APPROVE: {
      await rest.editMessage(existingMessageChannelId, existingMessageId, {
        embed: {
          color: COLORS.APPROVED,
          ...existingMessage.embeds[0]
        }
      })
        .catch(e => void logger.warn(
          `Failed to edit "existingMessage" ${existingMessageId} in channel ${existingMessageChannelId}`,
          { topic: 'REACTION HANDLING APPROVE ERROR', guildId: reaction.guild_id, ...e }
        ));

      const newMessageChannelId = isInGuestQueue ? data.answers_channel : data.guest_queue!;

      // @ts-ignore
      // TODO(didinele): Dumbass fucking bug already fixed in master - wait for next discord-api-types release
      const newMessage = await rest
        .sendMessage(newMessageChannelId, { embed: existingMessage.embeds[0]! })
        .catch(e => void logger.warn(
          `Failed to post "newMessage" in channel ${newMessageChannelId}`,
          { topic: 'REACTION HANDLING APPROVE ERROR', guildId: reaction.guild_id, ...e }
        ));

      if (!newMessage) return null;

      if (!isInGuestQueue) {
        for (const emoji of [EMOJI.APPROVE, EMOJI.DENY]) {
          // TODO(didinele): Replace with the line bellow once cordis util fixes this
          await container.resolve<Rest>(kRest)
            .put(Routes.channelMessageOwnReaction(data.guest_queue!, newMessage.id, encodeURIComponent(emoji)))
            .catch(e => logger.warn(`Failed to react with ${emoji}: ${e.message}`, {
              topic: 'APPROVE ADD REACTIONS ERROR',
              guildId: reaction.guild_id,
              channelId: reaction.channel_id,
              messageId: newMessage.id,
              ...e
            }));
        }
      }

      await sql`UPDATE ama_questions SET guest_queue_message_id = ${newMessage.id}`;
      break;
    }

    case EMOJI.DENY: {
      await rest.editMessage(existingMessageChannelId, existingMessageId, {
        embed: {
          color: COLORS.DENIED,
          ...existingMessage.embeds[0]
        }
      })
        .catch(e => logger.warn(
          `Failed to edit "existingMessage" ${existingMessageId} in channel ${existingMessageChannelId}`, {
            topic: 'REACTION HANDLING DENY ERROR',
            guildId: reaction.guild_id,
            ...e
          }
        ));

      break;
    }

    case EMOJI.ABUSE: {
      if (!isMod) return null;

      await rest.editMessage(existingMessageChannelId, existingMessageId, {
        embed: {
          color: COLORS.FLAGGED,
          ...existingMessage.embeds[0]
        }
      })
        .catch(e => logger.warn(
          `Failed to edit "existingMessage" ${existingMessageId} in channel ${existingMessageChannelId}`,
          { topic: 'REACTION HANDLING ABUSE ERROR', guildId: reaction.guild_id, ...e }
        ));

      // @ts-ignore
      // TODO(didinele): Dumbass fucking bug already fixed in master - wait for next discord-api-types release
      await rest
        .sendMessage(data.flagged_queue!, { embed: existingMessage.embeds[0] })
        .catch(e => logger.warn('Failed to post flagged message', {
          topic: 'REACTION HANDLING ABUSE ERROR',
          guildId: reaction.guild_id,
          ...e
        }));

      break;
    }
  }

  for (const emoji of Object.values(EMOJI)) {
    await rest.deleteUserReaction(reaction.channel_id, reaction.message_id, encodeURIComponent(emoji)).catch(() => null);
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
