import { ApplicationCommandOptionType } from 'discord-api-types/v8';

export const StartCommand = {
  name: 'start',
  description: 'Starts an AMA session',
  options: [
    {
      name: 'answerschannel',
      description: 'Designated channel for your guest to answer questions in',
      type: ApplicationCommandOptionType.Channel,
      required: true
    },
    {
      name: 'guestrole',
      description: 'Role ID for the guests',
      type: ApplicationCommandOptionType.Role,
      required: true
    }
  ]
} as const;
