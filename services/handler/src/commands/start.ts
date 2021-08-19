import { ArgumentsOf, ControlFlowError, send, UserPerms } from '../util';
import { inject, injectable } from 'tsyringe';
import { kSQL, Ama, Settings } from '@ama/common';
import { StartCommand } from '../interactions/start';
import { Command } from '../Command';
import { APIGuildInteraction, ChannelType, APIChannel, Routes } from 'discord-api-types/v9';
import { Rest } from '@cordis/rest';
import type { Sql } from 'postgres';

@injectable()
export default class implements Command {
  public readonly userPermissions = UserPerms.admin;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>,
    public readonly rest: Rest
  ) {}

  public parse(args: ArgumentsOf<typeof StartCommand>) {
    return {
      channelId: args.answerschannel.id,
      guestRoleId: args.guestrole.id
    };
  }

  public async exec(message: APIGuildInteraction, args: ArgumentsOf<typeof StartCommand>) {
    const { channelId, guestRoleId } = this.parse(args);

    const [settings] = await this.sql<[Settings?]>`SELECT * FROM settings WHERE guild_id = ${message.guild_id}`;
    if (!settings || Object.values(settings).length !== 5 || Object.values(settings).includes(null)) {
      throw new ControlFlowError('Please configure the bot using `/config` before attempting to start an AMA');
    }

    const [existingAma] = await this.sql<[Ama?]>`
      SELECT * FROM amas
      WHERE guild_id = ${message.guild_id}
      AND ended = false
    `;

    if (existingAma) {
      throw new ControlFlowError(`There\'s already an on-going AMA in <#${existingAma.answers_channel}>.`);
    }

    const channel = await this.rest.get<APIChannel>(Routes.channel(channelId)).catch(() => null);

    if (!channel) {
      throw new ControlFlowError('Couldn\'t find the channel that you\'re trying to use.');
    }

    if (channel.type !== ChannelType.GuildText) {
      throw new ControlFlowError('Please provide a **text** channel.');
    }

    const ama: Omit<Ama, 'id' | 'ended'> = { guild_id: message.guild_id, answers_channel: channel.id, guest_role_id: guestRoleId };
    await this.sql`INSERT INTO amas ${this.sql(ama)}`;

    return send(message, { content: `Successfully started AMA in <#${channel.id}>` });
  }
}
