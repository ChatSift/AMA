import { createAmqp, RoutingClient } from '@cordis/brokers';
import { container, singleton, inject } from 'tsyringe';
import { Settings, Ama, AmaQuestion, AmaUser, Config, kConfig, kSQL, kLogger } from '@ama/common';
import { COMMANDS, UserPermissions } from './Command';
import { parseInteraction } from './parser';
import { memberPermissions, send, EMOJI, FlowControlError, getQuestionEmbed, QuestionState } from './util';
import { Args } from 'lexure';
import {
  APIInteraction,
  GatewayDispatchEvents,
  GatewayDispatchPayload,
  GatewayMessageReactionAddDispatch,
  APIApplicationCommandInteraction
} from 'discord-api-types/v8';
import { decrypt } from './util/crypt';
import type { Sql } from 'postgres';
import type { Logger } from 'pino';

type SanitizedEvents = {
  [K in GatewayDispatchEvents]: GatewayDispatchPayload & {
    t: K;
  };
};

export type DiscordEvents = {
  [K in keyof SanitizedEvents]: SanitizedEvents[K]['d'];
};

@singleton()
export class Gateway {
  public constructor(
    @inject(kConfig) public readonly config: Config
  ) {}

  private async onInteraction(interaction: APIApplicationCommandInteraction) {
    if (!('guild_id' in interaction)) return;

    switch (interaction.type) {

    }
  }

  public async init() {
    const { channel } = await createAmqp(this.config.amqpUrl);
    const gateway = new RoutingClient<keyof DiscordEvents, DiscordEvents>(channel);

    gateway.on(GatewayDispatchEvents.InteractionCreate, interaction => void this.onInteraction(interaction));

    await gateway.init({
      name: 'gateway',
      keys: [GatewayDispatchEvents.InteractionCreate],
      queue: 'handler'
    });

    return gateway;
  }
}

const interactionCreate = async (interaction: Required<APIInteraction>) => {
  const parsed = parseInteraction(interaction.data.options ?? []);
  const command = COMMANDS.get(interaction.data.name);

  if (!command) return null;

  try {
    if (command.userPermissions && (await memberPermissions(interaction.guild_id, interaction.member) < command.userPermissions)) {
      throw new FlowControlError(
        `Missing permission to run that command. You should be at least \`${UserPermissions[command.userPermissions]}\``
      );
    }

    await command.exec(interaction, new Args(parsed));
  } catch (e) {
    const logger = container.resolve<Logger>(kLogger);
    const internal = !(e instanceof FlowControlError);

    if (internal) logger.error({ topic: 'COMMAND ERROR', guildId: interaction.guild_id, e }, e.message ?? e.toString());

    return send(
      interaction, {
        content: internal
          ? `Something went wrong internally! You should never see an error message like this, please contact a developer.\n${e.message}`
          : e.message,
        flags: 64
      }
    )
      .catch(e => logger.error({ topic: 'COMMAND ERROR HANDLING ERROR', guildId: interaction.guild_id, e }, e.message ?? e.toString()));
  }
};

const messageReactionAdd = async (reaction: GatewayMessageReactionAddDispatch['d']) => {
  const sql = container.resolve<Sql<{}>>(kSQL);

  if (
    !reaction.guild_id ||
    reaction.member!.user!.bot ||
    !reaction.emoji.name ||
    !(Object.values(EMOJI) as string[]).includes(reaction.emoji.name)
  ) return null;

  const [data] = await sql<[(Settings & Ama & AmaQuestion & AmaUser)?]>`
    SELECT * FROM ama_questions

    INNER JOIN amas
    ON ama_questions.ama_id = amas.id

    INNER JOIN settings
    ON settings.guild_id = amas.guild_id

    INNER JOIN ama_users
    ON ama_users.ama_id = amas.id

    WHERE amas.ended = false
      AND ama_users.id = ama_questions.author_id
      AND amas.guild_id = ${reaction.guild_id}
      AND (ama_questions.mod_queue_message_id = ${reaction.message_id} OR ama_questions.guest_queue_message_id = ${reaction.message_id})
  `;

  if (!data) return null;

  for (const key of ['username', 'discriminator', 'content'] as const) {
    data[key] = decrypt(data[key]);
  }

  const isInGuestQueue = data.guest_queue_message_id === reaction.message_id;

  const existingMessageChannelId = isInGuestQueue ? data.guest_queue! : data.mod_queue!;
  const existingMessageId = isInGuestQueue ? data.guest_queue_message_id! : data.mod_queue_message_id;

  switch (reaction.emoji.name) {
    case EMOJI.APPROVE: {
      await rest
        .editMessage(existingMessageChannelId, existingMessageId, { embed: getQuestionEmbed(data, QuestionState.approved) })
        .catch(() => null);

      const newMessageChannelId = isInGuestQueue ? data.answers_channel : data.guest_queue!;

      const newMessage = await rest
        .sendMessage(
          newMessageChannelId, { embed: getQuestionEmbed(data, isInGuestQueue ? QuestionState.answered : QuestionState.approved) }
        )
        .catch(() => null);

      if (!newMessage) return null;

      if (!isInGuestQueue) {
        for (const emoji of [EMOJI.APPROVE, EMOJI.DENY]) {
          await rest
            .addReaction(data.guest_queue!, newMessage.id, encodeURIComponent(emoji))
            .catch(() => null);
        }
      }

      await sql`
        UPDATE ama_questions
        SET guest_queue_message_id = ${newMessage.id}
        WHERE mod_queue_message_id = ${data.mod_queue_message_id}
      `;

      break;
    }

    case EMOJI.DENY: {
      await rest
        .editMessage(existingMessageChannelId, existingMessageId, { embed: getQuestionEmbed(data, QuestionState.denied) })
        .catch(() => null);

      break;
    }

    case EMOJI.ABUSE: {
      await rest
        .editMessage(existingMessageChannelId, existingMessageId, { embed: getQuestionEmbed(data, QuestionState.flagged) })
        .catch(() => null);

      await rest
        .sendMessage(data.flagged_queue!, { embed: getQuestionEmbed(data) })
        .catch(() => null);

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
