import { APIApplicationCommand, ApplicationCommandOptionType } from 'discord-api-types/v8';

const startInteraction: Omit<APIApplicationCommand, 'id' | 'application_id'> = {
  name: 'ask',
  description: 'Asks a question',
  options: [
    {
      name: 'question',
      description: 'What you want to ask',
      type: ApplicationCommandOptionType.STRING,
      required: true
    }
  ]
};

export default startInteraction;
