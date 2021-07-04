import { inject, injectable } from 'tsyringe';
import { AmaQuestion, AmaUser, kSQL, Settings } from '@ama/common';
import { Component } from '../Component';
import { Rest } from '@cordis/rest';
import { decrypt, getQuestionEmbed, QuestionState } from '../util';
import {
  APIGuildInteraction,
  APIMessageComponentInteractionData,
  RESTPatchAPIChannelMessageJSONBody,
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
        embed: getQuestionEmbed(data, QuestionState.denied)
      }
    });
  }
}
