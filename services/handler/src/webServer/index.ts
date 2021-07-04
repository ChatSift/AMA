import { container } from 'tsyringe';
import polka, { IError, Request, Response } from 'polka';
import { createServer } from 'http';
import { Boom, isBoom, notFound } from '@hapi/boom';
import { sendBoom } from './sendBoom';
import { jsonParser } from './jsonParser';
import { kLogger } from '@ama/common';
import { handleWebhook } from './webhook';
import type { Logger } from 'pino';

export default polka({
  onError: (e: string | IError, _: Request, res: Response) => {
    const logger = container.resolve<Logger>(kLogger);

    res.setHeader('content-type', 'application/json');
    const boom = isBoom(e) ? e : new Boom(e);

    logger.error({ boom }, 'Internal server error');
    return sendBoom(boom, res);
  },
  onNoMatch: (_: Request, res: Response) => {
    res.setHeader('content-type', 'application/json');
    return sendBoom(notFound(), res);
  },
  server: createServer()
})
  .use(jsonParser)
  .post('/webhook', handleWebhook);
