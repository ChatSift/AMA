import { Route, RouteMethod } from '@chatsift/rest-utils';
import { badRequest, notFound } from '@hapi/boom';
import { PrismaClient } from '@prisma/client';
import type { NextHandler, Request, Response } from 'polka';
import { singleton } from 'tsyringe';
import type { Ama } from '../util/models';

@singleton()
export default class extends Route<Ama, never> {
	public info = {
		method: RouteMethod.get,
		path: '/ama/v1/guilds/:guildId/amas/:amaId',
	} as const;

	public constructor(private readonly prisma: PrismaClient) {
		super();
	}

	public async handle(req: Request, res: Response, next: NextHandler) {
		const { guildId, amaId } = req.params as { amaId: string; guildId: string };

		const amaIdNum = Number.parseInt(amaId, 10);
		if (Number.isNaN(amaIdNum)) {
			return next(badRequest('Invalid AMA ID'));
		}

		const ama = await this.prisma.ama.findFirst({
			where: {
				guildId,
				id: amaIdNum,
			},
		});
		if (!ama) {
			return next(notFound('AMA not found'));
		}

		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(ama));
	}
}
