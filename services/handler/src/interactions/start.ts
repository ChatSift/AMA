import { APIApplicationCommand, ApplicationCommandOptionType } from 'discord-api-types/v8';

const startInteraction: Omit<APIApplicationCommand, 'id' | 'application_id'> = {
  name: 'start',
  description: 'Starts an AMA session',
  options: [
    {
      name: 'answerschannel',
      description: 'Designated channel for your guest to answer questions in',
      type: ApplicationCommandOptionType.CHANNEL,
      required: true
    }
  ]
};

export default startInteraction;
