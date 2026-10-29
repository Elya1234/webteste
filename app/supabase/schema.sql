-- Base de l'application (Supabase → SQL Editor → coller et exécuter une fois).
-- Sécurité : chaque membre ne voit que son profil et ses commandes ; les prix ne sont jamais pris du téléphone.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  phone      text not null default '',
  is_admin   boolean not null default false,
  stripe_customer_id text,                  -- client Stripe : cartes enregistrées, dons mensuels
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,                 -- référence affichée (ex. DED-010)
  name text not null,
  description text not null default '',
  category text not null default 'Objets',
  price_cents integer not null check (price_cents > 0),
  image_url text,
  stock integer,                            -- null = illimité (dédicaces, plaques…)
  comment_label text,                       -- si renseigné : commentaire obligatoire à l'achat
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,   -- compte supprimé : la commande reste (comptabilité, reçus)
  kind text not null check (kind in ('shop', 'donation')),
  label text not null default '',
  status text not null default 'pending' check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  -- processing : prélèvement SEPA en cours (quelques jours) ; refunded : remboursé (en tout ou partie)
  total_cents integer not null,
  purpose text,                             -- dons : motif (cotisation, kibboud, neder…)
  dedication text,
  stripe_session_id text unique,
  stripe_payment_intent text,
  stripe_subscription_id text,              -- don mensuel : chaque mois payé crée une ligne
  payment_method text,                      -- card, sepa_debit, apple_pay, google_pay, link…
  receipt_url text,                         -- reçu Stripe
  refunded_cents integer not null default 0,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders on delete cascade,
  product_id uuid references public.products on delete set null,
  ref text not null, name text not null,
  unit_cents integer not null, qty integer not null check (qty > 0),
  comment text not null default ''
);

-- Dons mensuels (abonnements Stripe)
create table if not exists public.subscriptions (
  id text primary key,                      -- identifiant Stripe sub_…
  user_id uuid references auth.users on delete set null,
  amount_cents integer not null, purpose text not null default 'Don mensuel', dedication text,
  status text not null default 'active',    -- active, past_due, canceled…
  created_at timestamptz not null default now(), canceled_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;

drop policy if exists "profil: soi-même" on public.profiles;
create policy "profil: soi-même" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profil: modifier soi-même" on public.profiles;
create policy "profil: modifier soi-même" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and is_admin = (select is_admin from public.profiles where id = auth.uid()));

drop policy if exists "produits: lecture publique" on public.products;
create policy "produits: lecture publique" on public.products for select using (active or public.is_admin());
drop policy if exists "produits: gestion admin" on public.products;
create policy "produits: gestion admin" on public.products for all using (public.is_admin()) with check (public.is_admin());

-- commandes : lecture seule pour le membre ; création et paiement uniquement par les fonctions serveur (clé service)
drop policy if exists "commandes: les miennes" on public.orders;
create policy "commandes: les miennes" on public.orders for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "abonnements: les miens" on public.subscriptions;
create policy "abonnements: les miens" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "lignes: les miennes" on public.order_items;
create policy "lignes: les miennes" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

-- Téléphone : vide, ou numéro français (+33 et 9 chiffres) ou nord-américain (+1 et 10 chiffres). Vérifié ici, côté serveur.
alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles add constraint profiles_phone_format check (phone = '' or phone ~ '^\+(33[1-9][0-9]{8}|1[2-9][0-9]{2}[2-9][0-9]{6})$');
alter table public.profiles drop constraint if exists profiles_names_length;
alter table public.profiles add constraint profiles_names_length check (length(first_name) <= 60 and length(last_name) <= 60);

-- Profil créé automatiquement à l'inscription (un numéro mal formé est ignoré plutôt que d'empêcher l'inscription)
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare ph text := coalesce(new.raw_user_meta_data->>'phone', '');
begin
  if ph !~ '^\+(33[1-9][0-9]{8}|1[2-9][0-9]{2}[2-9][0-9]{6})$' then ph := ''; end if;
  insert into public.profiles (id, first_name, last_name, phone)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'first_name', ''), 60), left(coalesce(new.raw_user_meta_data->>'last_name', ''), 60), ph);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Suppression du compte depuis l'appli (exigée par Apple et Google).
create or replace function public.delete_my_account() returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Aucun article de départ : la boutique se remplit depuis l'application (Administration › Contenus).

-- ───────── Contenus : cours, vidéos, galerie (lecture publique, modification par les administrateurs) ─────────
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null, rav text not null default '', day text not null default '', time text not null default '',
  place text not null default '', audience text not null default 'Tous', description text not null default '',
  position integer not null default 0
);
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  title text not null, rav text not null default '',
  youtube_id text not null,                 -- la fin du lien YouTube : youtube.com/watch?v=XXXXXXXXXXX
  published_at date not null default current_date
);
create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  url text not null,                        -- photo envoyée dans Supabase → Storage (dossier public « galerie »)
  caption text not null default '', album text not null default 'La synagogue',
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['courses', 'videos', 'gallery'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "lecture publique" on public.%I', t);
    execute format('create policy "lecture publique" on public.%I for select using (true)', t);
    execute format('drop policy if exists "gestion admin" on public.%I', t);
    execute format('create policy "gestion admin" on public.%I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ───────── Espace administrateur : balises des membres et messages ─────────
alter table public.profiles add column if not exists tags text[] not null default '{}';   -- balises (ex. « Cotisant », « Conseil », « Femmes »)
alter table public.profiles add column if not exists admin_note text not null default '';
-- un membre ne peut pas changer ses propres balises ni sa note
drop policy if exists "profil: modifier soi-même" on public.profiles;
create policy "profil: modifier soi-même" on public.profiles for update using (id = auth.uid()) with check (
  id = auth.uid()
  and is_admin = (select p.is_admin from public.profiles p where p.id = auth.uid())
  and tags = (select p.tags from public.profiles p where p.id = auth.uid())
  and admin_note = (select p.admin_note from public.profiles p where p.id = auth.uid())
  and stripe_customer_id is not distinct from (select p.stripe_customer_id from public.profiles p where p.id = auth.uid()));

-- Messagerie : chaque membre a sa conversation privée avec l'administration.
-- Les messages de groupe (« à tous », « balise ») et les rappels de paiement y arrivent aussi.
create table if not exists public.messages (            -- journal des envois de groupe
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  kind text not null default 'broadcast' check (kind in ('broadcast', 'reminder')),
  title text not null, body text not null,
  target text not null default 'Tous'      -- résumé lisible : « Tous », « Balise : Cotisant », « 3 membres »
);
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,   -- le membre de la conversation
  from_admin boolean not null,
  kind text not null default 'text' check (kind in ('text', 'broadcast', 'reminder')),
  title text, body text not null,
  amount_cents integer check (amount_cents is null or amount_cents > 0),  -- rappel de paiement : montant proposé
  purpose text,                                                           -- rappel de paiement : motif (cotisation…)
  broadcast_id uuid references public.messages on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz                       -- lu par le destinataire (le membre, ou l'administration)
);
create index if not exists chat_messages_user on public.chat_messages (user_id, created_at);
alter table public.messages enable row level security;
alter table public.chat_messages enable row level security;
drop policy if exists "chat: ma conversation" on public.chat_messages;
create policy "chat: ma conversation" on public.chat_messages for select using (user_id = auth.uid());
drop policy if exists "chat: écrire à l'administration" on public.chat_messages;
create policy "chat: écrire à l'administration" on public.chat_messages for insert with check (
  user_id = auth.uid() and from_admin = false and kind = 'text' and amount_cents is null and broadcast_id is null and read_at is null
  and length(body) between 1 and 4000);
-- le membre marque comme lus les messages reçus (sans pouvoir modifier autre chose)
create or replace function public.mark_chat_read() returns void language sql security definer set search_path = public as $$
  update public.chat_messages set read_at = now() where user_id = auth.uid() and from_admin and read_at is null
$$;
revoke all on function public.mark_chat_read() from public, anon;
grant execute on function public.mark_chat_read() to authenticated;

-- Essais de code administrateur (blocage après 10 essais faux en 10 minutes) ; lisible seulement par le serveur
create table if not exists public.admin_attempts (id bigint generated always as identity primary key, at timestamptz not null default now());
alter table public.admin_attempts enable row level security;

-- Photos (boutique, galerie) : dossier public « media », envoi seulement par le serveur (lien signé)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ───────── Fiche de l'association (reçus, reçus fiscaux, mentions légales) : une seule ligne ─────────
create table if not exists public.association (
  id integer primary key default 1 check (id = 1),
  legal_name text not null default '', address text not null default '', postal_code text not null default '', city text not null default '',
  rna text not null default '', siret text not null default '', email text not null default '', phone text not null default '',
  object text not null default '', president text not null default '',
  tax_receipts boolean not null default false,   -- l'association peut délivrer des reçus fiscaux (art. 200 du CGI)
  category text not null default 'cultuelle' check (category in ('cultuelle', 'interet_general', 'utilite_publique')),
  updated_at timestamptz not null default now()
);
insert into public.association (id) values (1) on conflict do nothing;
alter table public.association enable row level security;
drop policy if exists "association: lecture publique" on public.association;
create policy "association: lecture publique" on public.association for select using (true);

-- Adresse du donateur : obligatoire sur un reçu fiscal
alter table public.profiles add column if not exists address text not null default '';
alter table public.profiles add column if not exists postal_code text not null default '';
alter table public.profiles add column if not exists city text not null default '';
-- numéro de reçu fiscal : suite continue, attribuée une seule fois par don
create sequence if not exists public.tax_receipt_seq;
alter table public.orders add column if not exists tax_receipt_no integer unique;
create or replace function public.tax_receipt_number(order_id uuid) returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  select tax_receipt_no into n from public.orders where id = order_id and user_id = auth.uid() and kind = 'donation' and status = 'paid';
  if not found then raise exception 'reçu indisponible'; end if;
  if n is null then
    n := nextval('public.tax_receipt_seq');
    update public.orders set tax_receipt_no = n where id = order_id;
  end if;
  return n;
end $$;
revoke all on function public.tax_receipt_number(uuid) from public, anon;
grant execute on function public.tax_receipt_number(uuid) to authenticated;
