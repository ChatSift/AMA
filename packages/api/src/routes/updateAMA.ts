import type { TRequest } from '@chatsift/rest-utils';
import { Route, RouteMethod } from '@chatsift/rest-utils';
import { badRequest, notFound } from '@hapi/boom';
import { PrismaClient } from '@prisma/client';
import type { BaseValidator, InferType } from '@sapphire/shapeshift';
import { s } from '@sapphire/shapeshift';
import type { NextHandler, Request, Response } from 'polka';
import { singleton } from 'tsyringe';
import type { Ama } from '../util/models';

const schema = s.object({
	ended: s.boolean,
}).strict;
type Body = InferType<typeof schema>;

@singleton()
export default class extends Route<Ama, Body> {
	public info = {
		method: RouteMethod.patch,
		path: '/ama/v1/guilds/:guildId/amas/:amaId',
	} as const;

	public override readonly bodyValidationSchema: BaseValidator<Body> = schema;

	public constructor(private readonly prisma: PrismaClient) {
		super();
	}

	public async handle(req: TRequest<Body>, res: Response, next: NextHandler) {
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

		const updatedAMA = await this.prisma.ama.update({
			where: {
				id: amaIdNum,
			},
			data: {
				ended: req.body.ended,
			},
		});

		res.statusCode = 200;
		res.setHeader('Content-Type', 'application/json');
		res.end(JSON.stringify(updatedAMA));
	}
}
