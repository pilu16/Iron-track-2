-- Migration: replace flat-column measurements table with typed-row measurements table

drop table if exists public.measurements cascade;

create table public.measurements (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  type        text not null,
  value       numeric(6,1) not null,
  unit        text not null default 'kg',
  measured_at timestamptz not null default now()
);

alter table public.measurements enable row level security;

create policy "measurements: own rows only"
  on public.measurements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index measurements_user_type_idx on public.measurements (user_id, type, measured_at desc);
