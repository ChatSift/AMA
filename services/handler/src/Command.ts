import { extname, basename } from 'path';
import type { APIInteraction } from 'discord-api-types/v8';
import type { Args } from 'lexure';

export enum UserPermissions {
  none,
  mod,
  admin
}

export interface Command {
  name?: string;
  description?: string;
  // figure out a way to properly use this in the future
  clientPermissions?: string[];
  userPermissions?: UserPermissions;
  exec(message: APIInteraction, args: Args): any;
}

export interface CommandInfo {
  name: string;
}

export const getCommandInfo = (path: string): CommandInfo | null => {
  if (extname(path) !== '.js') return null;
  return { name: basename(path, '.js') };
};
