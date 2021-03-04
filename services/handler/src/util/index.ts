import { kRest, kSQL, Settings } from '@ama/common';
import { container } from 'tsyringe';
import {
  APIInteraction,
  APIInteractionResponse,
  APIInteractionApplicationCommandCallbackData,
  RESTPostAPIChannelMessageJSONBody,
  Routes,
  RESTPostAPIInteractionCallbackJSONBody
} from 'discord-api-types/v8';
import { UserPermissions } from '../Command';
import type { RestManager } from '@cordis/rest';
import type { Sql } from 'postgres';

export const send = (
  message: APIInteraction,
  payload: RESTPostAPIChannelMessageJSONBody | APIInteractionApplicationCommandCallbackData,
  type: APIInteractionResponse['type'] = 4
) => {
  const rest = container.resolve<RestManager>(kRest);

  const { embed, ...r } = payload as RESTPostAPIChannelMessageJSONBody;
  const data = { ...r, embeds: embed ? [embed] : undefined };

  // TODO: Wait for cordis 0.1.7
  // @ts-ignore
  return rest.post<never, RESTPostAPIInteractionCallbackJSONBody>(
    Routes.interactionCallback(message.id, message.token),
    { data: { data, type } }
  );
};

export const memberPermissions = async (message: APIInteraction): Promise<UserPermissions> => {
  const sql = container.resolve<Sql<{}>>(kSQL);

  const [settings] = await sql<[Pick<Settings, 'mod_role' | 'admin_role'>?]>`
    SELECT mod_role, admin_role
    FROM settings
    WHERE guild_id = ${message.guild_id}
  `;

  if (settings) {
    for (const role of message.member.roles) {
      if (role === settings.admin_role) return UserPermissions.admin;
      if (role === settings.mod_role) return UserPermissions.mod;
    }

    return UserPermissions.none;
  }

  return UserPermissions.none;
};
