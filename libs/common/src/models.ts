export interface Settings {
  guild_id: string;
  admin_role?: string;
  mod_queue?: string;
  flagged_queue?: string;
  guest_queue?: string;
}

export interface Ama {
  id: number;
  guild_id: string;
  guest_role_id: string;
  answers_channel: string;
  ended: boolean;
}

export interface AmaUser {
  user_id: string;
  ama_id: number;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export interface AmaQuestion {
  question_id: number;
  ama_id: number;
  author_id: string;
  content: string;
}
