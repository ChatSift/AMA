import { send } from '../util';
import { inject, injectable } from 'tsyringe';
import { kSQL, Ama } from '@ama/common';
import { Command, UserPermissions } from '../Command';
import { APIInteraction } from 'discord-api-types/v8';
import type { Sql } from 'postgres';

@injectable()
export default class EndCommand implements Command {
  public readonly userPermissions = UserPermissions.admin;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>
  ) {}

  public async exec(message: APIInteraction) {
    const [existingAma] = await this.sql<[Ama?]>`
      SELECT * FROM amas
      WHERE guild_id = ${message.guild_id}
      AND ended = false
    `;

    if (!existingAma) throw new Error('There\'s no out-going AMA at the moment.');

    await this.sql`
      UPDATE amas
      SET ended = true
      WHERE guild_id = ${message.guild_id}
    `;

    return send(message, { content: 'Successfully ended the current AMA' });
  }
}
