CREATE TABLE IF NOT EXISTS settings (
  guild_id bigint PRIMARY KEY,
  mod_role bigint,
  admin_role bigint,
  mod_queue bigint,
  flagged_queue bigint,
  guest_queue bigint
);

CREATE TABLE IF NOT EXISTS amas (
  id serial PRIMARY KEY,
  guild_id bigint NOT NULL REFERENCES settings ON DELETE CASCADE,
  answers_channel bigint NOT NULL,
  ended boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS ama_questions (
  ama_id integer NOT NULL REFERENCES amas(id) ON DELETE CASCADE,
  author_id bigint NOT NULL,
  mod_queue_message_id bigint NOT NULL,
  guest_queue_message_id bigint
);
