import { container } from 'tsyringe';
import {
  APIInteraction,
  APIInteractionApplicationCommandCallbackData,
  RESTPostAPIChannelMessageJSONBody,
  RESTPostAPIInteractionCallbackJSONBody,
  InteractionResponseType
} from 'discord-api-types/v8';
import { kRest } from '@ama/common';
import type { IRouter } from '@cordis/rest';

export function send(
  message: APIInteraction,
  payload: RESTPostAPIChannelMessageJSONBody | APIInteractionApplicationCommandCallbackData,
  type: InteractionResponseType.ChannelMessageWithSource
): Promise<void>;

export function send(
  message: APIInteraction,
  payload: Pick<APIInteractionApplicationCommandCallbackData, 'flags'>,
  type: InteractionResponseType.DeferredChannelMessageWithSource
): Promise<void>;

export function send(
  message: APIInteraction,
  payload: {},
  type: InteractionResponseType.Pong
): Promise<void>;

export function send(
  message: APIInteraction,
  payload: RESTPostAPIChannelMessageJSONBody
  | APIInteractionApplicationCommandCallbackData
  | Pick<APIInteractionApplicationCommandCallbackData, 'flags'>,
  type: InteractionResponseType = InteractionResponseType.ChannelMessageWithSource
) {
  const { embed, ...r } = payload as RESTPostAPIChannelMessageJSONBody;
  const data = { ...r, embeds: embed ? [embed] : undefined } as unknown as APIInteractionApplicationCommandCallbackData;

  const router = container.resolve<IRouter>(kRest);
  return router.interactions![message.id]![message.token]!.callback!.post<never, RESTPostAPIInteractionCallbackJSONBody>({
    data: {
      data,
      type
    }
  });
}
