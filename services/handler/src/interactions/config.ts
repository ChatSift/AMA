import { APIApplicationCommand, ApplicationCommandOptionType } from 'discord-api-types/v8';

const commandInteraction: Omit<APIApplicationCommand, 'id' | 'application_id'> = {
  name: 'config',
  description: 'Updates your config - or simply displays it if no arguments are provided',
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

export default commandInteraction;
