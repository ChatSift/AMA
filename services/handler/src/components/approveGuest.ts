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
  public readonly name = 'approve_guest';

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>,
    public readonly rest: Rest
  ) {}

  public async exec(interaction: APIGuildInteraction) {
    const [
      ,,
      questionId,
      type
    ] = (interaction.data as APIMessageComponentInteractionData).custom_id.split('|') as [string, string, string, string];

    const isStage = type === 'stage';

    const [data] = await this.sql<[Settings & Ama & AmaQuestion & AmaUser]>`
      SELECT * FROM ama_questions

      INNER JOIN ama_users
      ON ama_users.user_id = ama_questions.author_id

      INNER JOIN settings
      ON settings.guild_id = ${interaction.guild_id}

      INNER JOIN amas
      ON amas.id = ama_questions.ama_id

      WHERE question_id = ${questionId}
    `;

    if (data.ended) {
      throw new ControlFlowError('This AMA has already ended');
    }

    for (const key of ['username', 'discriminator', 'content'] as const) {
      data[key] = decrypt(data[key]);
    }

    const [stage, text, deny] = (interaction as unknown as APIMessageComponentInteraction)
      .message
      .components![0]!
      .components as [APIButtonComponent, APIButtonComponent, APIButtonComponent];

    stage.style = isStage ? ButtonStyle.Primary : ButtonStyle.Secondary;
    text.style = isStage ? ButtonStyle.Secondary : ButtonStyle.Primary;
    deny.style = ButtonStyle.Secondary;

    await this.rest.patch<unknown, RESTPatchAPIChannelMessageJSONBody>(
      Routes.channelMessage(interaction.channel_id, (interaction as unknown as APIMessageComponentInteraction).message.id), {
        data: {
          embed: getQuestionEmbed(data, QuestionState.approved),
          // @ts-expect-error
          components: [
            {
              type: ComponentType.ActionRow,
              components: [stage, text, deny]
            }
          ]
        }
      }
    );

    await this.rest.post<unknown, RESTPostAPIChannelMessageJSONBody>(Routes.channelMessages(data.answers_channel), {
      data: {
        embed: getQuestionEmbed(data, QuestionState.answered, isStage)
      }
    });

    return send(interaction, { content: 'Successfully sent the question to the answers channel', flags: 64 });
  }
}

