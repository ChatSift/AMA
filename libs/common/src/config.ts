import { container } from 'tsyringe';
import { kConfig } from './symbols';

export interface Config {
  redisUrl: string;
  discordToken: string;
  clientId: `${bigint}`;
  dbUrl: string;
  nodeEnv: string;
  amqpUrl: string;
  testGuildId?: `${bigint}`;
}

export const initConfig = () => {
  const config: Config = {
    redisUrl: process.env.REDIS_URL!,
    discordToken: process.env.DISCORD_TOKEN!,
    clientId: process.env.CLIENT_ID as `${bigint}`,
    dbUrl: process.env.DB_URL!,
    nodeEnv: process.env.NODE_ENV ?? 'dev',
    amqpUrl: process.env.AMQP_URL!,
    testGuildId: process.env.TEST_GUILD_ID as `${bigint}`
  };

  container.register<Config>(kConfig, { useValue: config });
  return config;
};
