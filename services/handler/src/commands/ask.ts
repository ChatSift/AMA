import { send } from '../util';
import { inject, injectable } from 'tsyringe';
import { kSQL, Ama, kRest, Settings } from '@ama/common';
import { Command, UserPermissions } from '../Command';
import {
  APIInteraction,
  APIMessage,
  RESTPostAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageResult,
  Routes
} from 'discord-api-types/v8';
import type { Sql } from 'postgres';
import type { RestManager } from '@cordis/rest';
import type { Args } from 'lexure';

@injectable()
export default class AskCommand implements Command {
  public readonly userPermissions = UserPermissions.none;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>,
    @inject(kRest) public readonly rest: RestManager
  ) {}

  private async addReactions(message: APIMessage, data: Ama & Settings) {
    const emojis = ['🟩', '🟥', '🟧'];

    for (const emoji of emojis) {
      // TODO: Wait for cordis 0.1.7
      // @ts-ignore
      await this.rest.put(Routes.channelMessageOwnReaction(data.mod_queue!, message.id, encodeURIComponent(emoji)));
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

    if (!data) throw new Error('There\'s no out-going AMA at the moment.');

    const question = args.option('question')!;

    const { user } = message.member;

    // TODO: Wait for cordis 0.1.7
    // @ts-ignore
    const posted = await this.rest.post<RESTPostAPIChannelMessageResult, RESTPostAPIChannelMessageJSONBody>(
      Routes.channelMessages(data.mod_queue!),
      {
        data: {
          allowed_mentions: [],
          embed: {
            title: `${user.username}#${user.discriminator} (${user.id})`,
            description: question,
            timestamp: new Date()
          }
        }
      }
    );

    void this.addReactions(posted, data);

    await this.sql`
      INSERT INTO ama_questions (ama_id, author_id, mod_queue_message_id)
      VALUES (${data.id}, ${user.id}, ${posted.id})
    `;

    return send(message, { content: 'Successfully posted your question', flags: 64 });
  }
}
