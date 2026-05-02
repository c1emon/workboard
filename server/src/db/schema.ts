export const schemaSql = `
create table if not exists task_containers (
  id text primary key,
  type text not null check (type in ('operation', 'permit', 'patrol', 'other')),
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
  ext_data_json text not null default '{}',
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

create unique index if not exists leave_people_date_name_unique on leave_people (date, name);
`;
