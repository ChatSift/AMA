import 'reflect-metadata';

import { container } from 'tsyringe';
import { Rest } from '@cordis/rest';
import postgres, { Sql } from 'postgres';
import { kLogger, kSQL, initConfig } from '@ama/common';
import createLogger, { Logger } from 'pino';
import { Handler } from './handler';

void (async () => {
  const config = initConfig();
  const rest = new Rest(config.discordToken);

  const logger = createLogger({
    name: 'HANDLER',
    level: config.nodeEnv === 'prod' ? 'info' : 'trace'
  });

  const sql = postgres(config.dbUrl, {
    onnotice: notice => logger.debug({ topic: 'DB NOTICE', notice })
  });

  rest
    .on('response', async (req, res, rl) => {
      if (!res.ok) {
        logger.warn({
          topic: 'REQUEST FAILURE',
          res: await res.json(),
          rl
        }, `Failed request ${req.method!} ${req.path!}`);
      }
    })
    .on('ratelimit', (bucket, endpoint, prevented, waitingFor) => {
      logger.warn({
        topic: 'RATELIMIT',
        bucket,
        prevented,
        waitingFor
      }, `Hit a ratelimit on ${endpoint}`);
    });

  if (config.nodeEnv === 'dev') {
    rest.on('request', req => logger.trace({ topic: 'REQUEST START' }, `Making request ${req.method!} ${req.path!}`));
  }

  container.register<Logger>(kLogger, { useValue: logger });
  container.register<Sql<{}>>(kSQL, { useValue: sql });
  container.register(Rest, { useValue: rest });

  await container.resolve(Handler).init();
})();
