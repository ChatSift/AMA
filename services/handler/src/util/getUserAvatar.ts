import { APIUser, RouteBases } from 'discord-api-types/v8';
import { makeDiscordCdnUrl } from '@cordis/util';

export const getUserAvatar = (user: Pick<APIUser, 'id' | 'avatar' | 'discriminator'>) => {
  if (!user.avatar) {
    return `${RouteBases.cdn}/embed/avatars/${parseInt(user.discriminator) % 5}.png`;
  }

  return makeDiscordCdnUrl(`${RouteBases.cdn}/avatars/${user.id}/${user.avatar}`);
};
