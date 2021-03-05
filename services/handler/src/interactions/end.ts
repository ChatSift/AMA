import type { APIApplicationCommand } from 'discord-api-types/v8';

const endInteraction: Omit<APIApplicationCommand, 'id' | 'application_id'> = {
  name: 'end',
  description: 'Ends the current AMA session'
};

export default endInteraction;
