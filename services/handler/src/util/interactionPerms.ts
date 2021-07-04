import { container } from 'tsyringe';
import { Sql } from 'postgres';
import { Rest } from '@cordis/rest';
import { Settings, kLogger, kSQL } from '@ama/common';
import { APIGuildInteraction, RESTGetAPIGuildResult, Routes } from 'discord-api-types/v8';
import { Permissions } from './Permissions';
import type { Logger } from 'pino';

export enum UserPerms {
  none,
  admin,
  owner
}

const checkAdmin = async (interaction: APIGuildInteraction): Promise<boolean> => {
  if (new Permissions(BigInt(interaction.member.permissions)).has('manageGuild', true)) {
    return true;
  }

  const sql = container.resolve<Sql<{}>>(kSQL);
  const [
    { admin_role } = { admin_role: null }
  ] = await sql<[Pick<Settings, 'admin_role'>?]>`SELECT admin_role FROM settings WHERE guild_id = ${interaction.guild_id}`;

  if (!admin_role) {
    return false;
  }

  return interaction.member.roles.includes(admin_role);
};


const checkOwner = async (interaction: APIGuildInteraction): Promise<boolean> => {
  const rest = container.resolve(Rest);
  const logger = container.resolve<Logger>(kLogger);

  const guild = await rest.get<RESTGetAPIGuildResult>(Routes.guild(interaction.guild_id)).catch(error => {
    logger.warn({ error }, 'Failed a checkOwner guild fetch - returning false');
    return null;
  });

  if (!guild) {
    return false;
  }

  return interaction.member.user.id === guild.owner_id;
};

export const checkPerm = async (interaction: APIGuildInteraction, perm: UserPerms): Promise<boolean> => {
  switch (perm) {
    case UserPerms.none: return true;
    // Checks are in order of speed (simple bitfield math -> db query + array find -> HTTP call and string comparison)
    case UserPerms.admin: return await checkAdmin(interaction) || checkOwner(interaction);
    case UserPerms.owner: return checkOwner(interaction);
  }
};
