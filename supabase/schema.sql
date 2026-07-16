-- =========================================================
-- ESQUEMA: Plataforma de órdenes de juegos
-- Ejecuta esto completo en Supabase > SQL Editor
-- =========================================================

-- Extensión para UUID
create extension if not exists "uuid-ossp";

-- ---------- PERFILES (clientes, pros, admin) ----------
create type user_role as enum ('client', 'pro', 'admin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role user_role not null default 'client',
  avatar_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Crea automáticamente un perfil "client" cuando alguien se registra
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'client');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------- JUEGOS (catálogo principal) ----------
create table games (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique not null,
  image_url text,
  description text,
  base_price numeric(10,2) not null default 4.99,
  options_config jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- SECUENCIA PARA NÚMERO DE ORDEN ----------
create sequence order_number_seq start 1000;

-- ---------- ÓRDENES ----------
create type order_status as enum (
  'pending_payment',
  'paid',
  'assigned',
  'in_progress',
  'delivered',
  'completed',
  'pro_paid',
  'cancelled'
);

create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text unique not null default ('ORD-' || nextval('order_number_seq')::text),
  client_id uuid not null references profiles(id),
  pro_id uuid references profiles(id),
  game_id uuid references games(id),
  is_custom boolean not null default false,
  title text not null,
  description text,
  price numeric(10,2) not null,
  price_confirmed boolean not null default true,
  status order_status not null default 'pending_payment',
  stripe_session_id text,
  stripe_payment_intent text,
  paid_at timestamptz,
  delivered_at timestamptz,
  evidence_url text,
  confirmed_by text,
  pro_payout_due_at timestamptz,
  pro_paid_at timestamptz,
  pro_paid_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Fecha del próximo desembolso a pros: solo hay 2 al mes, día 14 y día 28
create function next_payout_date(from_ts timestamptz)
returns timestamptz as $$
declare
  d int := extract(day from from_ts)::int;
  y int := extract(year from from_ts)::int;
  m int := extract(month from from_ts)::int;
begin
  if d <= 14 then
    return make_date(y, m, 14)::timestamptz;
  elsif d <= 28 then
    return make_date(y, m, 28)::timestamptz;
  else
    if m = 12 then
      return make_date(y + 1, 1, 14)::timestamptz;
    else
      return make_date(y, m + 1, 14)::timestamptz;
    end if;
  end if;
end;
$$ language plpgsql immutable;

-- Cuando la orden se marca "paid" registra la fecha de pago del cliente.
-- Cuando se marca "completed" (trabajo entregado), calcula la próxima fecha
-- de pago al pro (día 14 o 28 del mes, lo que venga primero).
create function set_payout_due_date()
returns trigger as $$
begin
  if new.status = 'paid' and old.status is distinct from 'paid' then
    new.paid_at := now();
  end if;
  if new.status = 'completed' and old.status is distinct from 'completed' then
    new.pro_payout_due_at := next_payout_date(now());
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_set_payout_due
  before update on orders
  for each row execute procedure set_payout_due_date();

-- ---------- CONVERSACIONES (soporte y por orden) ----------
create type conversation_type as enum ('support', 'order');

create table conversations (
  id uuid primary key default uuid_generate_v4(),
  type conversation_type not null,
  client_id uuid not null references profiles(id),
  pro_id uuid references profiles(id),
  order_id uuid references orders(id),
  closed boolean not null default false,
  created_at timestamptz not null default now()
);

create table messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  content text not null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table profiles enable row level security;
alter table games enable row level security;
alter table orders enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- Helper: ¿el usuario actual es admin?
create function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- PROFILES
create policy "ver propio perfil o admin ve todos"
  on profiles for select
  using (id = auth.uid() or is_admin());

create policy "actualizar propio perfil"
  on profiles for update
  using (id = auth.uid() or is_admin());

-- GAMES (catálogo público de lectura)
create policy "juegos visibles para todos"
  on games for select using (true);

create policy "solo admin edita juegos"
  on games for all using (is_admin()) with check (is_admin());

-- ORDERS
create policy "cliente ve sus ordenes, pro ve las asignadas, admin ve todo"
  on orders for select
  using (client_id = auth.uid() or pro_id = auth.uid() or is_admin());

create policy "cliente crea su propia orden"
  on orders for insert
  with check (client_id = auth.uid());

create policy "admin y pro asignado actualizan orden"
  on orders for update
  using (is_admin() or pro_id = auth.uid());

create policy "cliente confirma su propia orden entregada"
  on orders for update
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

-- CONVERSATIONS
create policy "participantes o admin ven la conversacion"
  on conversations for select
  using (client_id = auth.uid() or pro_id = auth.uid() or is_admin());

create policy "cliente o admin crean conversacion"
  on conversations for insert
  with check (client_id = auth.uid() or is_admin());

-- MESSAGES
create policy "participantes o admin ven mensajes"
  on messages for select
  using (
    exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (c.client_id = auth.uid() or c.pro_id = auth.uid() or is_admin())
    )
  );

create policy "participantes o admin envian mensajes"
  on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
      and (c.client_id = auth.uid() or c.pro_id = auth.uid() or is_admin())
    )
  );

-- =========================================================
-- CATÁLOGO DE JUEGOS (leveling / progression focus)
-- =========================================================
insert into games (name, slug, image_url, description, base_price, options_config) values
  ('Space Marine 2', 'space-marine-2', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600', 'Fast campaign & Operations leveling, weapon mastery and class unlocks.', 4.99,
    '{"groups":[
      {"id":"service","label":"Service Type","type":"radio","options":[
        {"label":"Operations leveling (1 class)","price":10},
        {"label":"Weapon mastery (all weapons)","price":25},
        {"label":"Full class unlock (all 6 classes)","price":45}]},
      {"id":"addons","label":"Add-ons","type":"checkbox","options":[
        {"label":"Play together (duo session)","price":12},
        {"label":"Specific class request","price":8}]}
    ]}'::jsonb),
  ('Helldivers 2', 'helldivers-2', '/games/helldivers-2.jpg', 'Level up fast, unlock Warbonds and stratagems without the grind.', 4.99,
    '{"groups":[
      {"id":"service","label":"Service Type","type":"radio","options":[
        {"label":"Level 1-30 (Warbond unlocks)","price":10},
        {"label":"Level 1-60 (full progression)","price":25},
        {"label":"Specific Warbond completion","price":15}]},
      {"id":"addons","label":"Add-ons","type":"checkbox","options":[
        {"label":"Play together (duo session)","price":12},
        {"label":"Priority stratagem unlocks","price":8}]}
    ]}'::jsonb),
  ('Diablo 4', 'diablo-4', 'https://images.unsplash.com/photo-1580327332925-a10e6cb11baa?w=600', '1-70 fast leveling and season journey completion.', 4.99,
    '{"groups":[
      {"id":"service","label":"Service Type","type":"radio","options":[
        {"label":"Level 1-60","price":10},
        {"label":"Paragon push (60-100)","price":30},
        {"label":"Full Season Journey completion","price":40}]},
      {"id":"addons","label":"Add-ons","type":"checkbox","options":[
        {"label":"Play together (duo session)","price":15},
        {"label":"Nightmare Dungeon farming","price":10}]}
    ]}'::jsonb),
  ('ARC Raiders', 'arc-raiders', 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=600', 'Fast leveling, gear progression and blueprint farming.', 4.99,
    '{"groups":[
      {"id":"service","label":"Service Type","type":"radio","options":[
        {"label":"Fast leveling (10 levels)","price":10},
        {"label":"Full gear progression","price":25},
        {"label":"Blueprint farming bundle","price":30}]},
      {"id":"addons","label":"Add-ons","type":"checkbox","options":[
        {"label":"Play together (duo session)","price":12},
        {"label":"Specific blueprint request","price":8}]}
    ]}'::jsonb),
  ('Forza Horizon 5', 'forza-horizon', 'https://images.unsplash.com/photo-1560253023-3ec5d502959f?w=600', 'Fast leveling, cheap credits and car collection help.', 4.99,
    '{"groups":[
      {"id":"service","label":"Service Type","type":"radio","options":[
        {"label":"Level boost (10 levels)","price":10},
        {"label":"Credits farming (1M CR)","price":20},
        {"label":"Car collection help (accolades)","price":25}]},
      {"id":"addons","label":"Add-ons","type":"checkbox","options":[
        {"label":"Play together (duo session)","price":10},
        {"label":"Specific car request","price":8}]}
    ]}'::jsonb),
  ('Call of Duty: Black Ops 6', 'call-of-duty', '/games/call-of-duty.jpg', 'Weapon leveling, camo grinding and battle pass rushing.', 4.99,
    '{"groups":[
      {"id":"service","label":"Service Type","type":"radio","options":[
        {"label":"Weapon leveling (1 weapon, max level)","price":10},
        {"label":"Account leveling (1-55)","price":25},
        {"label":"Prestige push (1 full prestige)","price":40}]},
      {"id":"addons","label":"Add-ons","type":"checkbox","options":[
        {"label":"Play together (duo session)","price":15},
        {"label":"Specific camo request","price":10}]}
    ]}'::jsonb),
  ('Destiny 2', 'destiny-2', '/games/destiny-2.jpg', 'Raid clears, dungeon runs, Trials wins and power leveling.', 4.99,
    '{"groups":[
      {"id":"service","label":"Service Type","type":"radio","options":[
        {"label":"Weekly Raid Clear","price":30},
        {"label":"Dungeon Clear","price":20},
        {"label":"Trials of Osiris (7 wins)","price":25},
        {"label":"Power Leveling (to cap)","price":20},
        {"label":"Exotic Mission Completion","price":15}]},
      {"id":"addons","label":"Add-ons","type":"checkbox","options":[
        {"label":"Play together (duo/fireteam)","price":12},
        {"label":"Flawless run (no deaths)","price":10}]}
    ]}'::jsonb),
  ('Elden Ring', 'elden-ring', '/games/elden-ring.jpg', 'Boss kills, full playthrough completion and rune farming.', 4.99,
    '{"groups":[
      {"id":"service","label":"Service Type","type":"radio","options":[
        {"label":"Specific Boss Kill","price":15},
        {"label":"Full Playthrough (any ending)","price":95},
        {"label":"Rune Farming Session","price":20},
        {"label":"Weapon / Item Acquisition","price":15}]},
      {"id":"addons","label":"Add-ons","type":"checkbox","options":[
        {"label":"Play together (duo session)","price":12},
        {"label":"No summons / solo challenge run","price":15}]}
    ]}'::jsonb),
  ('Monster Hunter Wilds', 'monster-hunter-wilds', '/games/monster-hunter-wilds.jpg', 'Story completion, monster kills, builds, armor sets and HR leveling.', 4.99,
    '{"groups":[
      {"id":"story","label":"Story Completion","type":"radio","options":[
        {"label":"Skip","price":0},
        {"label":"3 Chapters + Build","price":45},
        {"label":"Full Story (6 Chapters)","price":105}]},
      {"id":"monster","label":"Monster Kill / Quest","type":"radio","options":[
        {"label":"Skip","price":0},
        {"label":"Tempered Arkveld","price":15},
        {"label":"Tempered Gore Magala","price":12},
        {"label":"Tempered Rey Dau","price":12},
        {"label":"Tempered Nu Udra","price":12},
        {"label":"Tempered Uth Duna","price":12},
        {"label":"Tempered HR 31 & Below","price":10},
        {"label":"Any High Rank Quest","price":10},
        {"label":"Any Low Rank Quest","price":10}]},
      {"id":"build","label":"Build (Armor & Weapon)","type":"radio","options":[
        {"label":"Skip","price":0},
        {"label":"Early Build (4-star)","price":20},
        {"label":"Mid Build (6-star)","price":50},
        {"label":"Late Build (Artian + 8-star)","price":80}]},
      {"id":"armor","label":"Armor Full Set","type":"radio","options":[
        {"label":"Skip","price":0},
        {"label":"Low Rank Set","price":10},
        {"label":"High Rank Set (6-star)","price":20},
        {"label":"Any 8-star Set","price":40}]},
      {"id":"hrleveling","label":"High Rank Leveling (from HR41)","type":"radio","options":[
        {"label":"Skip","price":0},
        {"label":"+10 HR levels","price":50},
        {"label":"+25 HR levels","price":110}]},
      {"id":"crowns","label":"Crowns","type":"checkbox","options":[
        {"label":"Large or Mini Crown (1x)","price":20}]}
    ]}'::jsonb),
  ('Palworld', 'palworld', '/games/palworld.jpg', 'Fast leveling, base building help and boss raid clears.', 4.99,
    '{"groups":[
      {"id":"service","label":"Service Type","type":"radio","options":[
        {"label":"Level boost (10 levels)","price":10},
        {"label":"Base building help","price":20},
        {"label":"Boss raid clear","price":18},
        {"label":"Rare Pal catching","price":15}]},
      {"id":"addons","label":"Add-ons","type":"checkbox","options":[
        {"label":"Play together (duo session)","price":10},
        {"label":"Specific Pal request","price":8}]}
    ]}'::jsonb);

-- =========================================================
-- STORAGE: comprobantes de entrega (capturas/video que sube el pro)
-- =========================================================
insert into storage.buckets (id, name, public)
values ('order-evidence', 'order-evidence', true)
on conflict (id) do nothing;

create policy "authenticated users can upload evidence"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'order-evidence');

create policy "anyone can view evidence"
  on storage.objects for select
  using (bucket_id = 'order-evidence');
