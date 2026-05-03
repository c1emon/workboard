export const schemaSql = `
drop table if exists task_items;
drop table if exists task_containers;

create table if not exists task_templates (
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
  ext_data_json text not null default '{}',
  created_at text not null,
  updated_at text not null
);

create table if not exists task_template_items (
  id text primary key,
  template_id text not null references task_templates(id) on delete cascade,
  offset_minutes integer not null,
  duration_minutes integer not null,
  content text not null default '',
  ext_data_json text not null default '{}',
  sort_order integer not null default 0
);

create table if not exists task_instances (
  id text primary key,
  type text not null check (type in ('operation', 'permit', 'patrol', 'other')),
  template_id text null references task_templates(id) on delete set null,
  source_template_item_id text null references task_template_items(id) on delete set null,
  source_type text not null check (source_type in ('generated', 'manual', 'override')),
  generation_key text null,
  occurrence_date text not null,
  start_at text not null,
  end_at text not null,
  content text not null default '',
  ext_data_json text not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  generated_at text not null,
  updated_at text not null
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
create index if not exists task_template_items_template_id_idx on task_template_items (template_id);
create index if not exists task_instances_date_type_idx on task_instances (occurrence_date, type);
create index if not exists task_instances_time_idx on task_instances (start_at, end_at);
create unique index if not exists task_instances_generation_key_unique on task_instances (generation_key) where generation_key is not null;
`;
