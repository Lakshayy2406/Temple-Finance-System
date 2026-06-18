-- Run this in the Supabase SQL editor for your project.

create extension if not exists "pgcrypto";

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  type text not null check (type in ('income', 'expense')),
  category text,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  receipt_no text,
  created_by uuid references auth.users(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions
add column if not exists converted_at timestamptz;

alter table public.transactions
add column if not exists receipt_no text;

create table if not exists public.receipt_counters (
  receipt_year integer primary key,
  last_number integer not null default 0
);

create or replace function public.receipt_year_from_transaction(row_date date, row_created_at timestamptz)
returns integer
language sql
stable
as $$
  select extract(year from coalesce(row_date, row_created_at::date, current_date))::integer;
$$;

create or replace function public.next_receipt_no(receipt_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_number integer;
  candidate_receipt text;
begin
  loop
    insert into public.receipt_counters(receipt_year, last_number)
    values (receipt_year, 1)
    on conflict (receipt_year)
    do update set last_number = public.receipt_counters.last_number + 1
    returning last_number into next_number;

    candidate_receipt = '#' || receipt_year || '-' || lpad(next_number::text, 4, '0');

    if not exists (
      select 1
      from public.transactions
      where receipt_no = candidate_receipt
    ) then
      return candidate_receipt;
    end if;
  end loop;
end;
$$;

create or replace function public.set_income_receipt_no()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'income'
    and coalesce(new.category, '') <> 'UPI Converted'
    and nullif(trim(coalesce(new.receipt_no, '')), '') is null then
    new.receipt_no = public.next_receipt_no(
      public.receipt_year_from_transaction(new.date, coalesce(new.created_at, now()))
    );
  end if;
  return new;
end;
$$;

drop trigger if exists transactions_set_income_receipt_no on public.transactions;
create trigger transactions_set_income_receipt_no
before insert on public.transactions
for each row
execute function public.set_income_receipt_no();

update public.transactions
set receipt_no = null
where type = 'income'
  and category = 'UPI Converted'
  and receipt_no is not null;

with existing_receipts as (
  select
    substring(receipt_no from '#([0-9]{4})-')::integer as receipt_year,
    substring(receipt_no from '-([0-9]+)$')::integer as receipt_number
  from public.transactions
  where type = 'income'
    and coalesce(category, '') <> 'UPI Converted'
    and receipt_no ~ '^#[0-9]{4}-[0-9]+$'
),
max_existing as (
  select receipt_year, max(receipt_number) as last_number
  from existing_receipts
  group by receipt_year
)
insert into public.receipt_counters(receipt_year, last_number)
select receipt_year, last_number
from max_existing
on conflict (receipt_year)
do update set last_number = greatest(public.receipt_counters.last_number, excluded.last_number);

do $$
declare
  income_record record;
begin
  for income_record in
    select
      id,
      public.receipt_year_from_transaction(date, created_at) as receipt_year
    from public.transactions
    where type = 'income'
      and coalesce(category, '') <> 'UPI Converted'
      and nullif(trim(coalesce(receipt_no, '')), '') is null
    order by date asc, created_at asc, id asc
  loop
    update public.transactions
    set receipt_no = public.next_receipt_no(income_record.receipt_year)
    where id = income_record.id;
  end loop;
end;
$$;

create unique index if not exists transactions_receipt_no_unique_idx
on public.transactions (receipt_no)
where receipt_no is not null;

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
