export interface Settings {
  guild_id: `${bigint}`;
  mod_role?: `${bigint}`;
  admin_role?: `${bigint}`;
  mod_queue?: `${bigint}`;
  flagged_queue?: `${bigint}`;
  guest_queue?: `${bigint}`;
}

export interface Ama {
  id: number;
  guild_id: `${bigint}`;
  guest_role_id: `${bigint}`;
  answers_channel: `${bigint}`;
  ended: boolean;
}

export interface AmaQuestion {
  ama_id: number;
  author_id: `${bigint}`;
  content: string;
  mod_queue_message_id: `${bigint}`;
  guest_queue_message_id?: `${bigint}`;
}

export interface AmaUser {
  id: `${bigint}`;
  ama_id: number;
  username: string;
  discriminator: string;
  avatar: string | null;
}
