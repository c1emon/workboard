export const schemaSql = `
create table if not exists task_containers (
  id text primary key,
  type text not null check (type in ('operation', 'patrol')),
  name text not null,
  description text not null default '',
  start_at text not null,
  end_at text not null,
  recurrence_type text not null check (recurrence_type in ('once', 'finite', 'infinite')),
  recurrence_interval_minutes integer,
  recurrence_count integer,
  skip_weekends integer not null default 0,
  skip_holidays integer not null default 0,
  enabled integer not null default 1,
  created_at text not null,
  updated_at text not null
);

create table if not exists task_items (
  id text primary key,
  container_id text not null references task_containers(id) on delete cascade,
  offset_minutes integer not null,
  duration_minutes integer not null,
  content text not null default '',
  time_tag text check (time_tag in ('全天', '上午', '下午')),
  target text not null default '',
  personnel text not null default '',
  vehicle text not null default '',
  other text not null default '',
  metadata_json text not null default '{}',
  sort_order integer not null default 0
);

create table if not exists permit_arrangements (
  id text primary key,
  date text not null,
  time_tag text not null check (time_tag in ('全天', '上午', '下午')),
  permit text not null,
  personnel text not null default '',
  area text not null default '',
  other text not null default '',
  enabled integer not null default 1,
  sort_order integer not null default 0
);

create table if not exists other_arrangements (
  id text primary key,
  date text not null,
  time_tag text not null check (time_tag in ('全天', '上午', '下午')),
  task text not null,
  personnel text not null default '',
  vehicle text not null default '',
  other text not null default '',
  enabled integer not null default 1,
  sort_order integer not null default 0
);

create table if not exists leave_people (
  id text primary key,
  date text not null,
  name text not null,
  enabled integer not null default 1,
  sort_order integer not null default 0
);

create table if not exists holidays (
  id text primary key,
  date text not null unique,
  name text not null default '',
  type text not null default 'holiday' check (type in ('holiday', 'adjusted_workday'))
);
`;
