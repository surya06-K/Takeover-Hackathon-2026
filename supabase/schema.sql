-- KaagazAI khata schema
-- Paste this once into: Supabase dashboard -> SQL editor -> Run.
-- The app talks to these tables server-side with the service-role key,
-- so RLS stays enabled with no public policies (deny-by-default).

create table if not exists shops (
  id text primary key,
  phone text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists parties (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  name text not null,
  phone text,
  name_variants jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists parties_shop_idx on parties(shop_id);
create unique index if not exists parties_shop_phone_uniq
  on parties(shop_id, phone) where phone is not null;

create table if not exists pages (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  page_number int not null,
  model text not null,
  register_type text not null default 'unknown',
  confidence numeric not null default 0,
  notes text not null default '',
  row_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists pages_shop_idx on pages(shop_id);

create table if not exists transactions (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  party_id text not null references parties(id) on delete cascade,
  type text not null check (type in ('credit','payment')),
  amount numeric not null check (amount >= 0),
  item text,
  txn_date text,
  raw_text text,
  page_id text references pages(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists txns_shop_idx on transactions(shop_id);
create index if not exists txns_party_idx on transactions(party_id);

-- Sales / Bill Book: party is free text (no party matching in v1)
create table if not exists sale_entries (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  page_id text references pages(id) on delete set null,
  party_name text,
  item text,
  qty numeric,
  amount numeric not null check (amount >= 0),
  txn_date text,
  raw_text text,
  created_at timestamptz not null default now()
);
create index if not exists sale_entries_shop_idx on sale_entries(shop_id);

-- Stock Register: items moving in or out
create table if not exists stock_entries (
  id text primary key,
  shop_id text not null references shops(id) on delete cascade,
  page_id text references pages(id) on delete set null,
  item text not null,
  qty numeric not null check (qty >= 0),
  direction text not null check (direction in ('in','out')),
  amount numeric,
  txn_date text,
  raw_text text,
  created_at timestamptz not null default now()
);
create index if not exists stock_entries_shop_idx on stock_entries(shop_id);

alter table shops enable row level security;
alter table parties enable row level security;
alter table pages enable row level security;
alter table transactions enable row level security;
alter table sale_entries enable row level security;
alter table stock_entries enable row level security;

-- Restock reminders: per-item "remind me at" quantity level
create table if not exists stock_reminders (
  shop_id text not null references shops(id) on delete cascade,
  item_key text not null,
  min_qty numeric not null default 0 check (min_qty >= 0),
  updated_at timestamptz not null default now(),
  primary key (shop_id, item_key)
);
alter table stock_reminders enable row level security;
