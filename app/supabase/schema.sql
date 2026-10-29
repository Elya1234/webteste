-- Base de l'application (Supabase → SQL Editor → coller et exécuter une fois).
-- Sécurité : chaque membre ne voit que son profil et ses commandes ; les prix ne sont jamais pris du téléphone.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  phone      text not null default '',
  is_admin   boolean not null default false,
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
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  total_cents integer not null,
  purpose text,                             -- dons : motif (cotisation, kibboud, neder…)
  dedication text,
  stripe_session_id text unique,
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

alter table public.profiles enable row level security;
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
drop policy if exists "lignes: les miennes" on public.order_items;
create policy "lignes: les miennes" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));

-- Profil créé automatiquement à l'inscription
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'first_name', ''), coalesce(new.raw_user_meta_data->>'last_name', ''), coalesce(new.raw_user_meta_data->>'phone', ''));
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

-- Articles de départ (à modifier ensuite dans Supabase → Table Editor → products)
insert into public.products (ref, name, description, category, price_cents, stock, comment_label) values
  ('SID-001', 'Siddour Patah Eliyahou', 'Rite séfarade, traduction et phonétique.', 'Livres', 2500, 12, null),
  ('MAH-002', 'Mahzor Roch Hachana – Kippour', 'Édition complète, 2 volumes.', 'Livres', 4500, 6, null),
  ('DED-010', 'Dédicace d''un livre de la synagogue', 'Une étiquette à votre nom (ou à la mémoire d''un proche) est collée dans un livre.', 'Dédicaces', 3600, null, 'Nom à inscrire (Leilouy Nichmat, Refoua Chelema…)'),
  ('PLQ-020', 'Plaque commémorative', 'Plaque gravée posée au mur du souvenir.', 'Dédicaces', 18000, null, 'Texte de la plaque (nom, nom du père / de la mère, date)'),
  ('KIP-030', 'Kippa brodée', 'Velours, broderie dorée.', 'Objets', 1200, 30, null),
  ('BOU-040', 'Bougies de Chabbat (boîte de 72)', 'Durée 3 h 30.', 'Objets', 800, 40, null)
on conflict (ref) do nothing;
