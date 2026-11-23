create table users (
  id uuid primary key,
  email text not null,
  normalized_email text not null unique,      -- lower(trim(email))
  password_hash text not null,
  failed_login_count int not null default 0,
  locked_until timestamptz null,
  created_at timestamptz not null default now()
);

create table todos (
  id uuid primary key,
  user_id uuid not null references users (id) on delete cascade,
  title varchar(200) not null,
  notes varchar(2000) null,
  is_completed boolean not null default false,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ix_todos_user_status_created
  on todos (user_id, is_completed, created_at desc);
