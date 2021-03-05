import { send } from '../util';
import { inject, injectable } from 'tsyringe';
import { kSQL, Ama, kRest, Settings } from '@ama/common';
import { Command, UserPermissions } from '../Command';
import { RestManager } from '@cordis/rest';
import { APIChannel, APIInteraction, ChannelType, Routes } from 'discord-api-types/v8';
import type { Sql } from 'postgres';
import type { Args } from 'lexure';

type SqlNoop<T> = { [K in keyof T]: T[K] };

@injectable()
export default class StartCommand implements Command {
  public readonly userPermissions = UserPermissions.admin;

  public constructor(
    @inject(kSQL) public readonly sql: Sql<{}>,
    @inject(kRest) public readonly rest: RestManager
  ) {}

  public async exec(message: APIInteraction, args: Args) {
    const [setting] = await this.sql<[Settings?]>`SELECT * FROM settings WHERE guild_id = ${message.guild_id}`;
    if (!setting) throw new Error('Please configure the bot using `/set` before attempting to start an AMA');

    const [existingAma] = await this.sql<[Ama?]>`
      SELECT * FROM amas
      WHERE guild_id = ${message.guild_id}
      AND ended = false
    `;

    if (existingAma) throw new Error(`There\'s already an on-going AMA in <#${existingAma.answers_channel}>.`);

    const channelId = args.option('answerschannel') as `${bigint}`;

    const channel = await this.rest
      .get<APIChannel, never>(Routes.channel(channelId))
      .catch(() => null);

    if (!channel) throw new Error('Couldn\'t find the channel that you\'re trying to use.');
    if (channel.type !== ChannelType.GUILD_TEXT) throw new Error('Please provide a **text** channel.');

    const ama: SqlNoop<Ama> = { guild_id: message.guild_id, answers_channel: channel.id };
    await this.sql`INSERT INTO amas ${this.sql(ama)}`;

    return send(message, { content: `Successfully started AMA in <#${channel.id}>` });
  }
}
