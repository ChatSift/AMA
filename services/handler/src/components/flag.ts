import { inject, injectable } from 'tsyringe';
import { Ama, AmaQuestion, AmaUser, kSQL, Settings } from '@ama/common';
import { Component } from '../Component';
import { Rest } from '@cordis/rest';
import { ControlFlowError, decrypt, getQuestionEmbed, QuestionState, send } from '../util';
import {
  APIButtonComponent,
  APIGuildInteraction,
  APIMessageComponentInteraction,
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

  public async exec(interaction: APIGuildInteraction) {
    const questionId = (interaction.data as APIMessageComponentInteractionData).custom_id.split('|').pop()!;

    const [data] = await this.sql<[Settings & Ama & AmaQuestion & AmaUser]>`
      SELECT * FROM ama_questions

      INNER JOIN ama_users
      ON ama_users.user_id = ama_questions.author_id

      INNER JOIN amas
      ON amas.id = ama_questions.ama_id

      INNER JOIN settings
      ON settings.guild_id = ${interaction.guild_id}

      WHERE question_id = ${questionId}
    `;

    if (data.ended) {
      throw new ControlFlowError('This AMA has already ended');
    }

    for (const key of ['username', 'discriminator', 'content'] as const) {
      data[key] = decrypt(data[key]);
    }

    const [approve, deny, flag] = (interaction as unknown as APIMessageComponentInteraction)
      .message
      .components![0]!
      .components as [APIButtonComponent, APIButtonComponent, APIButtonComponent];

    approve.style = ButtonStyle.Secondary;
    deny.style = ButtonStyle.Secondary;
    flag.style = ButtonStyle.Primary;

    await this.rest.patch<unknown, RESTPatchAPIChannelMessageJSONBody>(
      Routes.channelMessage(interaction.channel_id, (interaction as unknown as APIMessageComponentInteraction).message.id), {
        data: {
          embed: getQuestionEmbed(data, QuestionState.flagged),
          // @ts-expect-error
          components: [
            {
              type: ComponentType.ActionRow,
              components: [approve, deny, flag]
            }
          ]
        }
      }
    );

    await this.rest.post<unknown, RESTPostAPIChannelMessageJSONBody>(Routes.channelMessages(data.flagged_queue!), {
      data: {
        embed: getQuestionEmbed(data)
      }
    });

    return send(interaction, { content: 'Successfully sent the question to the abuse queue', flags: 64 });
  }
}
