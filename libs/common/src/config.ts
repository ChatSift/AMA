import { container } from 'tsyringe';
import { kConfig } from './symbols';

export interface Config {
  redisUrl: string;
  discordToken: string;
  clientId: `${bigint}`;
  dbUrl: string;
  nodeEnv: string;
  amqpUrl: string;
  ownerId: `${bigint}`;
  testGuildId?: `${bigint}`;
  encryptionKey: string;
}

export const initConfig = () => {
  const config: Config = {
    redisUrl: process.env.REDIS_URL!,
    discordToken: process.env.DISCORD_TOKEN!,
    clientId: process.env.CLIENT_ID as `${bigint}`,
    dbUrl: process.env.DB_URL!,
    nodeEnv: process.env.NODE_ENV ?? 'dev',
    amqpUrl: process.env.AMQP_URL!,
    ownerId: process.env.OWNER_ID! as `${bigint}`,
    testGuildId: process.env.TEST_GUILD_ID as `${bigint}`,
    encryptionKey: process.env.ENCRYPTION_KEY!
  };

  container.register<Config>(kConfig, { useValue: config });
  return config;
};
