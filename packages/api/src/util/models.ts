// !!! PLEASE READ !!!
// This file's content is snatched straight out of our generated @prisma/client
// It's here because we need it for Routes to use types that DON'T rely on prisma
// Because otherwise we would need to somehow share our prisma.schema (and 2 others) with the frontend
// Which would NOT work. Absolutely make sure to use the types below and to cast away any types from @prsisma/client

export interface Ama {
	answersChannel: string;
	ended: boolean;
	flaggedQueue: string | null;
	guestQueue: string | null;
	guildId: string;
	id: number;
	modQueue: string | null;
	promptChannelId: string;
	promptMessageId: string;
	stageOnly: boolean;
	title: string;
}

export interface AmaQuestion {
	amaId: number;
	authorId: string;
	content: string;
	id: number;
	imageUrl: string | null;
}
