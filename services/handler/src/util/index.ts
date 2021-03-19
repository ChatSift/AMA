import { kLogger, kRest, kSQL, Settings } from '@ama/common';
import { container } from 'tsyringe';
import {
  APIInteraction,
  APIInteractionApplicationCommandCallbackData,
  RESTPostAPIChannelMessageJSONBody,
  Routes,
  APIInteractionResponseType,
  RESTGetAPIGuildRolesResult
} from 'discord-api-types/v8';
import { Permissions } from './Permissions';
import { UserPermissions } from '../Command';
import { makeRestUtils } from '@cordis/util';
import type { Rest } from '@cordis/rest';
import type { Sql } from 'postgres';
import type { Logger } from 'winston';

export const rest = makeRestUtils(container.resolve<Rest>(kRest));

export const send = (
  message: APIInteraction,
  payload: RESTPostAPIChannelMessageJSONBody | APIInteractionApplicationCommandCallbackData,
  type: APIInteractionResponseType = APIInteractionResponseType.ChannelMessageWithSource
) => {
  const { embed, ...r } = payload as RESTPostAPIChannelMessageJSONBody;
  const data = { ...r, embeds: embed ? [embed] : undefined };

  // TODO(didinele): @cordis/util has no support for interactions atm
  return container.resolve<Rest>(kRest).post<never, any>(
    Routes.interactionCallback(message.id, message.token),
    { data: { data, type } }
  );
};

export const memberPermissions = async (
  guildId: `${bigint}`,
  member: { roles: string[]; permissions?: Permissions | `${bigint}` | bigint },
  settings?: Pick<Settings, 'mod_role' | 'admin_role'>
): Promise<UserPermissions> => {
  try {
    if (!member.permissions) {
    // TODO(didinele): Next cordis release
      const guildRoles = await container.resolve<Rest>(kRest).get<RESTGetAPIGuildRolesResult>(Routes.guildRoles(guildId));
      member.permissions = new Permissions(guildRoles.map(r => BigInt(r.permissions)));
    } else if (!(member.permissions instanceof Permissions)) {
      member.permissions = new Permissions(BigInt(member.permissions));
    }

    if (member.permissions.has('manageGuild')) return UserPermissions.admin;

    if (!settings) {
      const sql = container.resolve<Sql<{}>>(kSQL);
      [settings] = await sql<[Pick<Settings, 'mod_role' | 'admin_role'>?]>`
      SELECT mod_role, admin_role
      FROM settings
      WHERE guild_id = ${guildId}
    `;
    }

    if (settings) {
      for (const role of member.roles) {
        if (role === settings.admin_role) return UserPermissions.admin;
        if (role === settings.mod_role) return UserPermissions.mod;
      }
    }
  } catch (e) {
    const logger = container.resolve<Logger>(kLogger);
    logger.error(e.message ?? e.toString(), { topic: 'PERMISSION CALCULATION', guildId, ...e });
  }

  return UserPermissions.none;
};

export * from './Constants';
export * from './ControlFlowError';
export * from './Permissions';
