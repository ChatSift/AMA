import { ApplicationCommandOptionType } from 'discord-api-types/v8';

export const AskCommand = {
  name: 'ask',
  description: 'Asks a question',
  options: [
    {
      name: 'question',
      description: 'What you want to ask',
      type: ApplicationCommandOptionType.String,
      required: true
    }
  ]
} as const;
