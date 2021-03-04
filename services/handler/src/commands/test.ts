import { send } from '../util';
import type { Command } from '../Command';
import type { APIInteraction } from 'discord-api-types/v8';

export default class TestCommand implements Command {
  public exec(message: APIInteraction) {
    throw new Error('oops!');
    return send(message, { content: 'Hello world!' });
  }
}
