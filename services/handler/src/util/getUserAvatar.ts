import { APIUser, RouteBases, Snowflake } from 'discord-api-types/v8';
import { makeDiscordCdnUrl } from '@cordis/util';

export const getUserAvatar = (user: Pick<APIUser, 'avatar' | 'discriminator'> & { user_id: Snowflake }) => {
  if (!user.avatar) {
    return `${RouteBases.cdn}/embed/avatars/${parseInt(user.discriminator, 10) % 5}.png`;
  }

  return makeDiscordCdnUrl(`${RouteBases.cdn}/avatars/${user.user_id}/${user.avatar}`);
};
