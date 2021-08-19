import { ControlFlowError, send, UserPerms } from '../util';
import { inject, injectable } from 'tsyringe';
import { kSQL, Ama } from '@ama/common';
import { Command } from '../Command';
import { APIGuildInteraction } from 'discord-api-types/v9';
import type { Sql } from 'postgres';

@injectable()
export default class implements Command {
  public readonly userPermissions = UserPerms.admin;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>
  ) {}

  public async exec(message: APIGuildInteraction) {
    const [existingAma] = await this.sql<[Ama?]>`
      SELECT * FROM amas
      WHERE guild_id = ${message.guild_id}
      AND ended = false
    `;

    if (!existingAma) {
      throw new ControlFlowError('There\'s no out-going AMA at the moment.');
    }

    await this.sql<[{ id: number }]>`
      UPDATE amas
      SET ended = true
      WHERE guild_id = ${message.guild_id}
      RETURNING id
    `;

    return send(message, { content: 'Successfully ended the current AMA' });
  }
}
