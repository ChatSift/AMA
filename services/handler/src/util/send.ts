import { Config, kConfig } from '@ama/common';
import { File, Rest } from '@cordis/rest';
import {
  APIInteractionResponseCallbackData,
  InteractionResponseType,
  RESTPostAPIChannelMessageJSONBody,
  Routes
} from 'discord-api-types/v9';
import { container } from 'tsyringe';

export interface SendOptions {
  type?: InteractionResponseType;
  update?: boolean;
}

const REPLIED = new Set<string>();

/**
 * @param message Interaction to respond to
 * @param payload Payload response data
 * @param type The type of response to provide
 * @param followup If this is a followup to the original interaction response
 */
export const send = async (
  message: any,
  payload: (RESTPostAPIChannelMessageJSONBody | APIInteractionResponseCallbackData) & { files?: File[] },
  type?: InteractionResponseType,
  followup = false
): Promise<unknown> => {
  const rest = container.resolve(Rest);
  const { clientId } = container.resolve<Config>(kConfig);

  if ('token' in message) {
    const { embed, files, ...r } = payload as RESTPostAPIChannelMessageJSONBody & { files?: File[] };
    const response = { ...r, embeds: embed ? [embed] : undefined };

    if (followup) {
      const { files, ...r } = payload;
      return rest.post(Routes.webhook(clientId, message.token), { data: r, files });
    }

    if (REPLIED.has(message.token)) {
      // TODO cordis support for files in PATCH
      // return rest.patch(Routes.webhookMessage(clientId, message.token, '@original'), { data: response, files });
      return rest.make({
        method: 'PATCH',
        path: Routes.webhookMessage(clientId, message.token, '@original'),
        data: response,
        files
      });
    }

    if (message.res) {
      message.res.end(JSON.stringify({
        type: type ?? InteractionResponseType.ChannelMessageWithSource,
        data: response
      }));

      REPLIED.add(message.token);
      setTimeout(() => REPLIED.delete(message.token), 6e4);

      if (files) {
        await send(message, { files });
      }

      return;
    }
  }

  const { files, ...r } = payload;

  return rest.post<unknown, RESTPostAPIChannelMessageJSONBody>(Routes.channelMessages(message.channel_id), { data: r, files });
};
