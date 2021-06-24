import { send } from '../util';
import { inject, injectable } from 'tsyringe';
import { kSQL, Settings } from '@ama/common';
import { stripIndents } from 'common-tags';
import { Command, UserPermissions } from '../Command';
import { APIGuildInteraction, InteractionResponseType } from 'discord-api-types/v8';
import type { Sql } from 'postgres';
import type { Args } from 'lexure';

@injectable()
export default class ConfigCommand implements Command {
  public readonly userPermissions = UserPermissions.admin;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>
  ) {}

  private _sendCurrentSettings(message: APIGuildInteraction, settings?: Omit<Settings, 'guild_id'>) {
    const atRole = (role?: string) => role ? `<@&${role}>` : 'none';
    const atChannel = (channel?: string) => channel ? `<#${channel}>` : 'none';

    return send(message, {
      content: stripIndents`
        **Here are your current settings:**
        • admin role: ${atRole(settings?.admin_role)}
        • mod queue: ${atChannel(settings?.mod_queue)}
        • flagged questions: ${atChannel(settings?.flagged_queue)}
        • guest queue ${atChannel(settings?.guest_queue)}
      `,
      allowed_mentions: { parse: [] }
    }, InteractionResponseType.ChannelMessageWithSource);
  }

  public async exec(message: APIGuildInteraction, args: Args) {
    let settings: Omit<Settings, 'guild_id'> = {};

    const admin_role = args.option('adminrole');
    const mod_queue = args.option('modqueue');
    const flagged_queue = args.option('flagged');
    const guest_queue = args.option('guestqueue');

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
