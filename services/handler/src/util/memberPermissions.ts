import { container } from 'tsyringe';
import { UserPermissions } from '../Command';
import { Permissions } from './Permissions';
import { Config, kConfig, kLogger, kRest, kSQL, Settings } from '@ama/common';
import type { IRouter } from '@cordis/rest';
import type { Sql } from 'postgres';
import type { Logger } from 'pino';
import type { APIUser, RESTGetAPIGuildRolesResult } from 'discord-api-types/v8';

export const memberPermissions = async (
  guildId: `${bigint}`,
  member: { user: Pick<APIUser, 'id'>; roles: string[]; permissions?: Permissions | `${bigint}` | bigint },
  settings?: Pick<Settings, 'admin_role'>
): Promise<UserPermissions> => {
  if (member.user.id === container.resolve<Config>(kConfig).ownerId) return UserPermissions.admin;

  try {
    if (!settings) {
      const sql = container.resolve<Sql<{}>>(kSQL);
      [settings] = await sql<[Pick<Settings, 'admin_role'>?]>`
        SELECT admin_role
        FROM settings
        WHERE guild_id = ${guildId}
      `;
    }

    if (settings) {
      for (const role of member.roles) {
        if (role === settings.admin_role) return UserPermissions.admin;
      }
    }

    if (!member.permissions) {
      const router = container.resolve<IRouter>(kRest);
      const guildRoles = await router.guilds![guildId]!.roles!.get<RESTGetAPIGuildRolesResult>();

      const roles = new Set(member.roles);
      member.permissions = new Permissions(guildRoles.filter(r => roles.has(r.id)).map(r => BigInt(r.permissions)));
    } else if (!(member.permissions instanceof Permissions)) {
      member.permissions = new Permissions(BigInt(member.permissions));
    }

    if (member.permissions.has('manageGuild')) return UserPermissions.admin;
  } catch (e) {
    const logger = container.resolve<Logger>(kLogger);
    logger.error({ topic: 'PERMISSION CALCULATION', guildId, ...e }, e.message ?? e.toString());
  }

  return UserPermissions.none;
};
