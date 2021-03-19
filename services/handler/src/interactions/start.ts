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
    },
    {
      name: 'guestrole',
      description: 'Role ID for the guests',
      type: ApplicationCommandOptionType.ROLE,
      required: true
    }
  ]
};

export default startInteraction;
