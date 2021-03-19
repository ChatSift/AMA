import { send } from '../util';
import { inject, injectable } from 'tsyringe';
import { kSQL, Settings } from '@ama/common';
import { Command, UserPermissions } from '../Command';
import type { Sql } from 'postgres';
import type { APIInteraction } from 'discord-api-types/v8';
import type { Args } from 'lexure';

@injectable()
export default class SetCommand implements Command {
  public readonly userPermissions = UserPermissions.admin;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>
  ) {}

  private _sendCurrentSettings(message: APIInteraction, settings?: Omit<Settings, 'guild_id'>) {
    return send(message, {
      content: Object
        .entries(settings ?? { admin_role: null, mod_role: null })
        .filter(([k]) => k !== 'guild_id')
        .map(([k, v]) => `${k}: ${v ?? 'none'}`)
        .join('\n')
    });
  }

  public async exec(message: APIInteraction, args: Args) {
    let settings: Omit<Settings, 'guild_id'> = {};

    const mod_role = args.option('modrole');
    const admin_role = args.option('adminrole');
    const mod_queue = args.option('questions');
    const flagged_queue = args.option('flagged');
    const guest_queue = args.option('guestquestions');

    if (mod_role) settings.mod_role = mod_role as `${bigint}`;
    if (admin_role) settings.admin_role = admin_role as `${bigint}`;
    if (mod_queue) settings.mod_queue = mod_queue as `${bigint}`;
    if (flagged_queue) settings.flagged_queue = flagged_queue as `${bigint}`;
    if (guest_queue) settings.guest_queue = guest_queue as `${bigint}`;

    if (!Object.values(settings).length) {
      const [currentSettings] = await this.sql<[Settings?]>`SELECT * FROM settings WHERE guild_id = ${message.guild_id}`;
      return this._sendCurrentSettings(message, currentSettings);
    }

    [settings] = await this.sql<[Settings]>`
      INSERT INTO settings ${this.sql({ guild_id: message.guild_id, ...settings })}
      ON CONFLICT (guild_id)
      DO
        UPDATE SET ${this.sql(settings)}
        RETURNING *;
    `;

    return this._sendCurrentSettings(message, settings);
  }
}
