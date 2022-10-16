import { Route, RouteMethod } from '@chatsift/rest-utils';
import { PrismaClient } from '@prisma/client';
import type { Request, Response } from 'polka';
import { singleton } from 'tsyringe';
import type { Ama } from '../util/models';

@singleton()
export default class extends Route<Ama[], never> {
	public info = {
		method: RouteMethod.get,
		path: '/ama/v1/guilds/:guildId/amas/',
	} as const;

	public constructor(private readonly prisma: PrismaClient) {
		super();
	}

	public async handle(req: Request, res: Response) {
		const { guildId } = req.params as { guildId: string };
		const amas = await this.prisma.ama.findMany({
			where: {
				guildId,
			},
		});

		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(amas));
	}
}
