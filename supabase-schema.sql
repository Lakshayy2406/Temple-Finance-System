-- Run this in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('income', 'expense')),
  category text,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  created_by uuid references auth.users(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions
add column if not exists converted_at timestamptz;

create index if not exists transactions_date_idx on public.transactions (date desc);
create index if not exists transactions_type_idx on public.transactions (type);
create index if not exists transactions_created_by_idx on public.transactions (created_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

alter table public.transactions enable row level security;

drop policy if exists "Admins can read transactions" on public.transactions;
drop policy if exists "Admins can insert transactions" on public.transactions;
drop policy if exists "Admins can update transactions" on public.transactions;
drop policy if exists "Admins can delete transactions" on public.transactions;

create policy "Admins can read transactions"
on public.transactions
for select
to authenticated
using (true);

create policy "Admins can insert transactions"
on public.transactions
for insert
to authenticated
with check (auth.uid() = created_by);

create policy "Admins can update transactions"
on public.transactions
for update
to authenticated
using (true)
with check (created_by is null or auth.uid() = created_by);

create policy "Admins can delete transactions"
on public.transactions
for delete
to authenticated
using (true);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
