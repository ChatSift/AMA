import { EMOJI, FlowControlError, rest, send } from '../util';
import { container, inject, injectable } from 'tsyringe';
import { kSQL, Ama, Settings, kRest, kLogger } from '@ama/common';
import { Command, UserPermissions } from '../Command';
import { APIInteraction, APIMessage, Routes } from 'discord-api-types/v8';
import type { Sql } from 'postgres';
import type { Args } from 'lexure';
import type { Rest } from '@cordis/rest';
import type { Logger } from 'winston';

@injectable()
export default class AskCommand implements Command {
  public readonly userPermissions = UserPermissions.none;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>,
    @inject(kLogger) public readonly logger: Logger
  ) {}

  private async addReactions(message: APIMessage, data: Ama & Settings) {
    for (const emoji of Object.values(EMOJI)) {
      // TODO(didinele): Replace with the line bellow once cordis util fixes this
      await container.resolve<Rest>(kRest)
        .put(Routes.channelMessageOwnReaction(data.mod_queue!, message.id, encodeURIComponent(emoji)))
        .catch(e => this.logger.warn(
          `Failed to react with ${emoji}`,
          { topic: 'ASK COMMAND ADD REACTIONS ERROR', guildId: message.guild_id, channelId: message.channel_id, messageId: message.id, ...e }
        ));
    }
  }

  public async exec(message: APIInteraction, args: Args) {
    const [data] = await this.sql<[(Ama & Settings)?]>`
      SELECT * FROM amas
      INNER JOIN settings
      ON amas.guild_id = settings.guild_id
      WHERE amas.guild_id = ${message.guild_id}
        AND amas.ended = false
    `;

    if (!data) throw new FlowControlError('There\'s no out-going AMA at the moment.');

    const question = args.option('question')!;
    const { user } = message.member;

    const posted = await rest.sendMessage(data.mod_queue!, {
      allowed_mentions: { parse: [] },
      embed: {
        title: `${user.username}#${user.discriminator} (${user.id})`,
        description: question,
        timestamp: new Date().toISOString()
      }
    });

    void this.addReactions(posted, data);

    await this.sql`
      INSERT INTO ama_questions (ama_id, author_id, mod_queue_message_id)
      VALUES (${data.id}, ${user.id}, ${posted.id})
    `;

    return send(message, { content: 'Successfully posted your question', flags: 64 });
  }
}
