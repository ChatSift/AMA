import { container } from 'tsyringe';
import { unauthorized } from '@hapi/boom';
import * as nacl from 'tweetnacl';
import { kConfig, Config } from '@ama/common';
import { InteractionResponseType, InteractionType } from 'discord-api-types/v8';
import { Handler } from '../handler';
import type { Request, Response, NextHandler } from 'polka';

export const handleWebhook = async (req: Request, res: Response, next: NextHandler) => {
  const config = container.resolve<Config>(kConfig);
  const handler = container.resolve(Handler);

  const signature = req.headers['x-signature-ed25519'] as string | undefined;
  const timestamp = req.headers['x-signature-timestamp'] as string | undefined;

  if (!signature || !timestamp) {
    return next(unauthorized('missing signature or timestamp'));
  }

  const isValid = nacl.sign.detached.verify(
    Buffer.from(timestamp + req.rawBody),
    Buffer.from(signature, 'hex'),
    Buffer.from(config.discordPubKey, 'hex')
  );

  if (!isValid) {
    return next(unauthorized('failed to validate request'));
  }

  const interaction = req.body;

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');

  if (interaction.type === InteractionType.Ping) {
    return res.end(JSON.stringify({ type: InteractionResponseType.Pong }));
  }

  res.end(JSON.stringify({ type: InteractionResponseType.DeferredChannelMessageWithSource }));

  void handler.handleInteraction(interaction);
};
