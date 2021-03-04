import type { APIApplicationCommand } from 'discord-api-types/v8';

const testInteraction: Omit<APIApplicationCommand, 'id' | 'application_id'> = {
  name: 'test',
  description: 'Tests things'
};

export default testInteraction;
