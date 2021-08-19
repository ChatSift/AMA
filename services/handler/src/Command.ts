import { basename, extname } from 'path';
import { UserPerms } from './util';
import type { APIGuildInteraction } from 'discord-api-types/v9';
export interface Command {
  name?: string;
  userPermissions?: UserPerms;
  exec(message: APIGuildInteraction, args: unknown): unknown;
}

export interface CommandInfo {
  name: string;
}

export const commandInfo = (path: string): CommandInfo | null => {
  if (extname(path) !== '.js') {
    return null;
  }

  return {
    name: basename(path, '.js')
  };
};
