import { FlowControlError, rest, send } from '../util';
import { inject, injectable } from 'tsyringe';
import { kSQL, Ama, Settings } from '@ama/common';
import { Command, UserPermissions } from '../Command';
import { APIInteraction, ChannelType } from 'discord-api-types/v8';
import type { Sql } from 'postgres';
import type { Args } from 'lexure';

@injectable()
export default class StartCommand implements Command {
  public readonly userPermissions = UserPermissions.admin;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>
  ) {}

  public async exec(message: APIInteraction, args: Args) {
    const [settings] = await this.sql<[Settings?]>`SELECT * FROM settings WHERE guild_id = ${message.guild_id}`;
    if (!settings || Object.values(settings).includes(null)) {
      throw new FlowControlError('Please configure the bot using `/set` before attempting to start an AMA');
    }

    const [existingAma] = await this.sql<[Ama?]>`
      SELECT * FROM amas
      WHERE guild_id = ${message.guild_id}
      AND ended = false
    `;

    if (existingAma) throw new FlowControlError(`There\'s already an on-going AMA in <#${existingAma.answers_channel}>.`);

    const channelId = args.option('answerschannel') as `${bigint}`;
    const guestRoleId = args.option('guestrole') as `${bigint}`;

    const channel = await rest.fetchChannel(channelId).catch(() => null);

    if (!channel) throw new FlowControlError('Couldn\'t find the channel that you\'re trying to use.');
    if (channel.type !== ChannelType.GUILD_TEXT) throw new FlowControlError('Please provide a **text** channel.');

    const ama: Omit<Ama, 'id' | 'ended'> = { guild_id: message.guild_id, answers_channel: channel.id, guest_role_id: guestRoleId };
    await this.sql`INSERT INTO amas ${this.sql(ama)}`;

    return send(message, { content: `Successfully started AMA in <#${channel.id}>` });
  }
}
