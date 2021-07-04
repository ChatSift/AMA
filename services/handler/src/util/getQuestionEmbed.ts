import { COLORS } from './Constants';
import { getUserAvatar } from './getUserAvatar';
import type { APIEmbed, APIUser, Snowflake } from 'discord-api-types/v8';

export enum QuestionState {
  approved,
  answered,
  denied,
  flagged
}

export const getQuestionEmbed = (
  data: Pick<APIUser, 'avatar' | 'discriminator' | 'username'> & { user_id: Snowflake; content: string },
  state?: QuestionState
): APIEmbed => {
  let color;

  switch (state) {
    case QuestionState.approved: color = COLORS.APPROVED; break;
    case QuestionState.answered: color = COLORS.BLURPLE; break;
    case QuestionState.denied: color = COLORS.DENIED; break;
    case QuestionState.flagged: color = COLORS.FLAGGED; break;
    default: break;
  }

  return {
    author: {
      name: `${data.username}#${data.discriminator} (${data.user_id})`,
      icon_url: getUserAvatar(data)
    },
    description: data.content,
    color
  };
};
