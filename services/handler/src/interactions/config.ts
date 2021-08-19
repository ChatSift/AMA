import { ApplicationCommandOptionType } from 'discord-api-types/v9';

export const ConfigCommand = {
  name: 'config',
  description: 'Updates your config - or simply displays it if no arguments are provided',
  options: [
    {
      name: 'adminrole',
      description: 'Admin role for your server',
      type: ApplicationCommandOptionType.Role,
      required: false
    },
    {
      name: 'modqueue',
      description: 'Mod queue for new incoming questions',
      type: ApplicationCommandOptionType.Channel,
      required: false
    },
    {
      name: 'flagged',
      description: 'Queue for flagged questions',
      type: ApplicationCommandOptionType.Channel,
      required: false
    },
    {
      name: 'guestqueue',
      description: 'Queue for your guest to review the questions they wish to answer',
      type: ApplicationCommandOptionType.Channel,
      required: false
    }
  ]
} as const;
