import { Config, kConfig, kLogger, kRest, kSQL, Settings } from '@ama/common';
import { container } from 'tsyringe';
import {
  APIInteraction,
  APIInteractionApplicationCommandCallbackData,
  RESTPostAPIChannelMessageJSONBody,
  Routes,
  APIInteractionResponseType,
  APIUser
} from 'discord-api-types/v8';
import { Permissions } from './Permissions';
import { UserPermissions } from '../Command';
import { makeDiscordCdnUrl, makeRestUtils } from '@cordis/util';
import { ENDPOINTS } from '@cordis/common';
import { COLORS } from './Constants';
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
      const guildRoles = await rest.fetchRoles(guildId);
      const roles = new Set(member.roles);
      member.permissions = new Permissions(guildRoles.filter(r => roles.has(r.id)).map(r => BigInt(r.permissions)));
    } else if (!(member.permissions instanceof Permissions)) {
      member.permissions = new Permissions(BigInt(member.permissions));
    }

    if (member.permissions.has('manageGuild')) return UserPermissions.admin;
  } catch (e) {
    const logger = container.resolve<Logger>(kLogger);
    logger.error(e.message ?? e.toString(), { topic: 'PERMISSION CALCULATION', guildId, ...e });
  }

  return UserPermissions.none;
};

export const getUserAvatar = (user: Pick<APIUser, 'id' | 'avatar' | 'discriminator'>) => {
  // TODO(didinele): Use discord-api-types endpoints once that's merged
  if (!user.avatar) return `${ENDPOINTS.cdn}/embed/avatars/${parseInt(user.discriminator) % 5}.png`;
  return makeDiscordCdnUrl(`${ENDPOINTS.cdn}/avatars/${user.id}/${user.avatar}`);
};

export enum QuestionState {
  approved,
  answered,
  denied,
  flagged
}

export const getQuestionEmbed = (
  data: Pick<APIUser, 'avatar' | 'discriminator' | 'username' | 'id'> & { content: string },
  state?: QuestionState
) => {
  let color;

  switch (state) {
    case QuestionState.approved: color = COLORS.APPROVED; break;
    case QuestionState.answered: color = COLORS.BLURPLE; break;
    case QuestionState.denied: color = COLORS.DENIED; break;
    case QuestionState.flagged: color = COLORS.FLAGGED; break;
    default: break;
  }

  return {
    author: {
      name: `${data.username}#${data.discriminator} (${data.id})`,
      icon_url: getUserAvatar(data)
    },
    description: data.content,
    timestamp: new Date().toISOString(),
    color
  };
};

export * from './Constants';
export * from './ControlFlowError';
export * from './Permissions';
