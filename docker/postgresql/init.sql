CREATE TABLE IF NOT EXISTS settings (
  guild_id bigint PRIMARY KEY,
  mod_role bigint NOT NULL,
  admin_role bigint NOT NULL
);
