-- Almas back office, Cloudflare D1 (SQLite). Applied statement by statement by deploy.py; every statement is
-- idempotent ("if not exists"), so a redeploy never touches existing rows. One statement per ";".

create table if not exists orders (
  id text primary key,
  at text not null,
  lang text not null default 'ar',
  name text not null default '',
  phone text not null default '',
  phone_norm text not null default '',
  address text not null default '',
  notes text not null default '',
  pay text not null default 'cod',
  paid integer not null default 0,
  paid_at text,
  stripe_session text,
  total real not null default 0,
  status text not null default 'new',
  admin_note text not null default '',
  source text not null default '',
  updated_at text
);
create index if not exists orders_at on orders (at);
create index if not exists orders_phone on orders (phone_norm, at);
create index if not exists orders_status on orders (status, at);

-- idx = position of the line in the order: (order_id, idx) is unique, so a retried ingest cannot duplicate a line
create table if not exists order_items (
  order_id text not null,
  idx integer not null,
  product text not null,
  name_till text not null default '',
  name text not null default '',
  qty real not null,
  unit text not null default 'piece',
  unit_price real not null default 0,
  line real not null default 0,
  primary key (order_id, idx)
);
create index if not exists order_items_product on order_items (product);

create table if not exists customers (
  phone_norm text primary key,
  name text not null default '',
  kind text not null default 'home',
  business text not null default '',
  tags text not null default '',
  notes text not null default '',
  follow_up text not null default '',
  first_at text,
  last_at text,
  updated_at text
);

create table if not exists quotes (
  id text primary key,
  at text not null,
  lang text not null default 'ar',
  type text not null default '',
  business text not null default '',
  contact text not null default '',
  phone text not null default '',
  phone_norm text not null default '',
  city text not null default '',
  event_date text not null default '',
  guests text not null default '',
  freq text not null default '',
  items text not null default '',
  status text not null default 'new',
  admin_note text not null default '',
  updated_at text
);
create index if not exists quotes_at on quotes (at);
create index if not exists quotes_phone on quotes (phone_norm);

create table if not exists reviews (
  id integer primary key autoincrement,
  product text not null,
  rating integer not null,
  text text not null default '',
  name text not null default '',
  lang text not null default 'ar',
  order_id text not null default '',
  verified integer not null default 0,
  status text not null default 'pending',
  at text not null,
  ip_hash text not null default ''
);
create index if not exists reviews_product on reviews (product, status, at);
create index if not exists reviews_status on reviews (status, at);

-- rate limits: k = 'login:<iphash>' or 'review:<iphash>', at = unix seconds. Raw addresses are never stored.
create table if not exists hits (k text not null, at integer not null);
create index if not exists hits_k on hits (k, at);

-- standing orders: a customer's basket repeated on a rhythm (7, 14 or 30 days). Requested from the website as
-- 'pending'; the owner activates it; each run creates a normal order at the day's till prices.
create table if not exists standing (
  id integer primary key autoincrement,
  phone_norm text not null,
  phone text not null default '',
  name text not null default '',
  business text not null default '',
  address text not null default '',
  notes text not null default '',
  admin_note text not null default '',
  lang text not null default 'ar',
  pay text not null default 'cod',
  every_days integer not null default 14,
  next_date text not null default '',
  items text not null default '[]',
  status text not null default 'pending',
  from_order text not null default '',
  last_order text not null default '',
  last_done text,
  created_at text not null,
  updated_at text
);
create index if not exists standing_due on standing (status, next_date);
create index if not exists standing_phone on standing (phone_norm);
create unique index if not exists standing_from on standing (from_order) where from_order <> '';
