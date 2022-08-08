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
    discordPubKey: string;
}
export declare const initConfig: () => Config;
//# sourceMappingURL=config.d.ts.map