CREATE TABLE IF NOT EXISTS settings (
  guild_id bigint PRIMARY KEY,
  mod_role bigint,
  admin_role bigint,
  mod_queue bigint,
  flagged_queue bigint,
  guest_queue bigint
);

CREATE TABLE IF NOT EXISTS amas (
  guild_id bigint NOT NULL REFERENCES settings ON DELETE CASCADE,
  answers_channel bigint NOT NULL,
  ended boolean NOT NULL DEFAULT false
);
