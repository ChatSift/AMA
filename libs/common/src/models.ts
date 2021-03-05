export interface Settings {
  guild_id: `${bigint}`;
  mod_role?: `${bigint}`;
  admin_role?: `${bigint}`;
  mod_queue?: `${bigint}`;
  flagged_queue?: `${bigint}`;
  guest_queue?: `${bigint}`;
}

export interface Ama {
  guild_id: `${bigint}`;
  answers_channel: `${bigint}`;
}
