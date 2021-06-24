import { EMOJI, FlowControlError, getQuestionEmbed, send } from '../util';
import { inject, injectable } from 'tsyringe';
import { kSQL, Ama, Settings, kRest } from '@ama/common';
import { Command, UserPermissions } from '../Command';
import { encrypt } from '../util/crypt';
import {
  APIGuildInteraction,
  RESTPostAPIChannelMessageResult,
  RESTPostAPIChannelMessageJSONBody,
  InteractionResponseType
} from 'discord-api-types/v8';
import type { Sql } from 'postgres';
import type { Args } from 'lexure';
import type { IRouter } from '@cordis/rest';

@injectable()
export default class AskCommand implements Command {
  public readonly userPermissions = UserPermissions.none;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>,
    @inject(kRest) public readonly rest: IRouter
  ) {}

  public async exec(message: APIGuildInteraction, args: Args) {
    const [data] = await this.sql<[(Ama & Settings)?]>`
      SELECT * FROM amas
      INNER JOIN settings
      ON amas.guild_id = settings.guild_id
      WHERE amas.guild_id = ${message.guild_id}
        AND amas.ended = false
    `;

    if (!data) throw new FlowControlError('There\'s no out-going AMA at the moment.');

    const content = args.option('question')!;
    const { user } = message.member;

    const route = this.rest.channels![data.mod_queue!]!.messages!;
    const posted = await route.post<RESTPostAPIChannelMessageResult, RESTPostAPIChannelMessageJSONBody>({
      data: {
        allowed_mentions: { parse: [] },
        embed: getQuestionEmbed({ content, ...user })
      }
    });

    await this.sql.begin(async sql => {
      await sql`
        INSERT INTO ama_users (id, ama_id, username, discriminator, avatar)
        VALUES (${user.id}, ${data.id}, ${encrypt(user.username)}, ${encrypt(user.discriminator)}, ${user.avatar})
        ON CONFLICT (id)
        DO UPDATE SET ama_id = ${data.id},
          username = ${encrypt(user.username)},
          discriminator = ${encrypt(user.discriminator)},
          avatar = ${user.avatar}
      `;

      await sql`
        INSERT INTO ama_questions (ama_id, author_id, content, mod_queue_message_id)
        VALUES (${data.id}, ${user.id}, ${encrypt(content)}, ${posted.id})
      `;
    });

    await send(message, { content: 'Successfully submitted your question', flags: 64 }, InteractionResponseType.ChannelMessageWithSource);

    for (const emoji of Object.values(EMOJI)) {
      await this.rest.channels![data.mod_queue!]!.messages![posted.id]!.reactions![encodeURIComponent(emoji)]!['@me']!.put();
    }
  }
}
