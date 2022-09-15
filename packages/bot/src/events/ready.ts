import type { Client} from 'discord.js';
import { Events } from 'discord.js';
import { singleton } from 'tsyringe';
import type { Event } from '#struct/Event';
import { logger } from '#util/logger';

@singleton()
export default class implements Event<typeof Events.ClientReady> {
	public readonly name = Events.ClientReady;

	public handle(client: Client<true>) {
		logger.info(`Ready as ${client.user.tag} (${client.user.id})`);
	}
}
