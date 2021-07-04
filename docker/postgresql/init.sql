CREATE TABLE IF NOT EXISTS settings (
  guild_id bigint PRIMARY KEY,
  admin_role bigint,
  mod_queue bigint,
  flagged_queue bigint,
  guest_queue bigint
);

CREATE TABLE IF NOT EXISTS amas (
  id serial PRIMARY KEY,
  guild_id bigint NOT NULL REFERENCES settings ON DELETE CASCADE,
  guest_role_id bigint NOT NULL,
  answers_channel bigint NOT NULL,
  ended boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS ama_users (
  user_id bigint PRIMARY KEY,
  ama_id integer NOT NULL REFERENCES amas(id) ON DELETE CASCADE,
  username text NOT NULL,
  discriminator text NOT NULL,
  avatar text
);

CREATE TABLE IF NOT EXISTS ama_questions (
  question_id serial PRIMARY KEY,
  ama_id integer NOT NULL REFERENCES amas(id) ON DELETE CASCADE,
  author_id bigint NOT NULL,
  content TEXT NOT NULL
);
