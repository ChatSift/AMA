import { APIApplicationCommand, ApplicationCommandOptionType } from 'discord-api-types/v8';

const setInteraction: Omit<APIApplicationCommand, 'id' | 'application_id'> = {
  name: 'set',
  description: 'Updates your config',
  options: [
    {
      name: 'adminrole',
      description: 'Admin role for your server',
      type: ApplicationCommandOptionType.ROLE,
      required: false
    },
    {
      name: 'modrole',
      description: 'Mod role for your server',
      type: ApplicationCommandOptionType.ROLE,
      required: false
    },
    {
      name: 'questions',
      description: 'Mod queue for new incoming questions',
      type: ApplicationCommandOptionType.CHANNEL,
      required: false
    },
    {
      name: 'flagged',
      description: 'Queue for flagged questions',
      type: ApplicationCommandOptionType.CHANNEL,
      required: false
    },
    {
      name: 'guestquestions',
      description: 'Queue for your guest to review the questions they wish to answer',
      type: ApplicationCommandOptionType.CHANNEL,
      required: false
    }
  ]
};

export default setInteraction;
