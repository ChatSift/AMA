import { inject, injectable } from 'tsyringe';
import { ControlFlowError, getQuestionEmbed, send, ArgumentsOf, UserPerms } from '../util';
import { kSQL, Ama, Settings, AmaQuestion } from '@ama/common';
import { Command } from '../Command';
import { encrypt } from '../util/crypt';
import { AskCommand } from '../interactions/ask';
import {
  APIGuildInteraction,
  RESTPostAPIChannelMessageResult,
  RESTPostAPIChannelMessageJSONBody,
  Routes,
  ComponentType,
  ButtonStyle
} from 'discord-api-types/v8';
import { nanoid } from 'nanoid';
import { Rest } from '@cordis/rest';
import type { Sql } from 'postgres';

@injectable()
export default class implements Command {
  public readonly userPermissions = UserPerms.none;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>,
    public readonly rest: Rest
  ) {}

  public parse(args: ArgumentsOf<typeof AskCommand>) {
    return {
      question: args.question
    };
  }

  public async exec(message: APIGuildInteraction, args: ArgumentsOf<typeof AskCommand>) {
    const { question } = this.parse(args);

    const [data] = await this.sql<[(Ama & Settings)?]>`
      SELECT * FROM amas
      INNER JOIN settings
      ON amas.guild_id = settings.guild_id
      WHERE amas.guild_id = ${message.guild_id}
        AND amas.ended = false
    `;

    if (!data) {
      throw new ControlFlowError('There\'s no out-going AMA at the moment.');
    }

    const { user } = message.member;

    const id = nanoid();

    const [{ id: questionId }] = await this.sql.begin(async (sql): Promise<[Pick<AmaQuestion, 'id'>]> => {
      await sql`
        INSERT INTO ama_users (id, ama_id, username, discriminator, avatar)
        VALUES (${user.id}, ${data.id}, ${encrypt(user.username)}, ${encrypt(user.discriminator)}, ${user.avatar})
        ON CONFLICT (id)
        DO UPDATE SET ama_id = ${data.id},
          username = ${encrypt(user.username)},
          discriminator = ${encrypt(user.discriminator)},
          avatar = ${user.avatar}
      `;

      return sql`
        INSERT INTO ama_questions (ama_id, author_id, content, mod_queue_message_id)
        VALUES (${data.id}, ${user.id}, ${encrypt(question)}, ${posted.id})
        RETURNING id
      `;
    });

    const posted = await this.rest.post<RESTPostAPIChannelMessageResult, RESTPostAPIChannelMessageJSONBody>(
      Routes.channelMessages(data.mod_queue!), {
        data: {
          allowed_mentions: { parse: [] },
          embed: getQuestionEmbed({ content: question, ...user }),
          // @ts-expect-error
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  label: 'Approve',
                  style: ButtonStyle.Success,
                  custom_id: `approve|${id}|${questionId}`
                },
                {
                  type: ComponentType.Button,
                  label: '⚠ Flag',
                  style: ButtonStyle.Secondary,
                  custom_id: `flag|${id}|${questionId}`
                },
                {
                  type: ComponentType.Button,
                  label: 'Deny',
                  style: ButtonStyle.Danger,
                  custom_id: `deny|${id}|${questionId}`
                }
              ]
            }
          ]
        }
      }
    );

    await send(message, { content: 'Successfully submitted your question', flags: 64 });
  }
}
