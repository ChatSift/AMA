import { ArgumentsOf, ControlFlowError, send, UserPerms } from '../util';
import { inject, injectable } from 'tsyringe';
import { kSQL, Settings } from '@ama/common';
import { stripIndents } from 'common-tags';
import { ConfigCommand } from '../interactions/config';
import { Command } from '../Command';
import { APIGuildInteraction, ChannelType } from 'discord-api-types/v9';
import type { Sql } from 'postgres';

@injectable()
export default class implements Command {
  public readonly userPermissions = UserPerms.admin;

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
    });
  }

  public parse(args: ArgumentsOf<typeof ConfigCommand>) {
    return {
      admin_role: args.adminrole?.id,
      mod_queue: args.modqueue?.id,
      flagged_queue: args.flagged,
      guest_queue: args.guestqueue
    };
  }

  public async exec(message: APIGuildInteraction, args: ArgumentsOf<typeof ConfigCommand>) {
    const { admin_role, mod_queue, flagged_queue, guest_queue } = this.parse(args);

    let settings: Omit<Settings, 'guild_id'> = {};

    if (admin_role) settings.admin_role = admin_role;
    if (mod_queue) settings.mod_queue = mod_queue;

    const textTypes = [ChannelType.GuildText, ChannelType.GuildPublicThread, ChannelType.GuildPrivateThread];

    if (flagged_queue) {
      if (!textTypes.includes(flagged_queue.type)) {
        throw new ControlFlowError('Please provide a valid **text** channel.');
      }

      settings.flagged_queue = flagged_queue.id;
    }

    if (guest_queue) {
      if (!textTypes.includes(guest_queue.type)) {
        throw new ControlFlowError('Please provide a valid **text** channel.');
      }

      settings.guest_queue = guest_queue.id;
    }

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
