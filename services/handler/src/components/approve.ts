import { inject, injectable } from 'tsyringe';
import { AmaQuestion, AmaUser, kSQL, Settings } from '@ama/common';
import { Component } from '../Component';
import { Rest } from '@cordis/rest';
import { decrypt, getQuestionEmbed, QuestionState } from '../util';
import { nanoid } from 'nanoid';
import {
  APIGuildInteraction,
  APIMessageComponentInteractionData,
  ButtonStyle,
  ComponentType,
  RESTPatchAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageJSONBody,
  Routes
} from 'discord-api-types/v8';
import type { Sql } from 'postgres';

@injectable()
export default class implements Component {
  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>,
    public readonly rest: Rest
  ) {}

  public async exec(message: APIGuildInteraction) {
    const questionId = (message.data as APIMessageComponentInteractionData).custom_id.split('|').pop()!;

    const [data] = await this.sql<[Settings & AmaQuestion & AmaUser]>`
      SELECT * FROM ama_questions

      INNER JOIN ama_users
      ON ama_users.id = ama_questions.author_id

      INNER JOIN settings
      ON settings.guild_id = ${message.guild_id}

      WHERE id = ${questionId}
    `;

    for (const key of ['username', 'discriminator', 'content'] as const) {
      data[key] = decrypt(data[key]);
    }

    await this.rest.patch<unknown, RESTPatchAPIChannelMessageJSONBody>(Routes.channelMessage(message.channel_id, message.id), {
      data: {
        embed: getQuestionEmbed(data, QuestionState.approved)
      }
    });

    const id = nanoid();

    await this.rest.post<unknown, RESTPostAPIChannelMessageJSONBody>(
      Routes.channelMessages(data.guest_queue!), {
        data: {
          allowed_mentions: { parse: [] },
          embed: getQuestionEmbed(data, QuestionState.approved),
          // @ts-expect-error
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  label: 'Approve',
                  style: ButtonStyle.Success,
                  custom_id: `approve_guest|${id}|${data.id}`
                },
                {
                  type: ComponentType.Button,
                  label: 'Deny',
                  style: ButtonStyle.Danger,
                  custom_id: `deny_guest|${id}|${data.id}`
                }
              ]
            }
          ]
        }
      }
    );
  }
}
