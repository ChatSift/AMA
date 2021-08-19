import { inject, injectable } from 'tsyringe';
import { Ama, AmaQuestion, AmaUser, kSQL, Settings } from '@ama/common';
import { Component } from '../Component';
import { Rest } from '@cordis/rest';
import { ControlFlowError, decrypt, getQuestionEmbed, QuestionState, send } from '../util';
import {
  InteractionResponseType,
  APIButtonComponent,
  APIGuildInteraction,
  APIMessageComponentInteraction,
  APIMessageComponentInteractionData,
  ButtonStyle,
  ComponentType,
  RESTPostAPIChannelMessageJSONBody,
  Routes
} from 'discord-api-types/v9';
import type { Sql } from 'postgres';

@injectable()
export default class implements Component {
  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>,
    public readonly rest: Rest
  ) {}

  public async exec(interaction: APIGuildInteraction) {
    void send(interaction, {}, InteractionResponseType.DeferredMessageUpdate);

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

    void send(interaction, {
      embed: getQuestionEmbed(data, QuestionState.flagged),
      components: [
        {
          type: ComponentType.ActionRow,
          components: [approve, deny, flag]
        }
      ]
    }, InteractionResponseType.UpdateMessage);

    void this.rest.post<unknown, RESTPostAPIChannelMessageJSONBody>(Routes.channelMessages(data.flagged_queue!), {
      data: {
        embed: getQuestionEmbed(data)
      }
    });
  }
}
