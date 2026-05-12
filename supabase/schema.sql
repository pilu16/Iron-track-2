-- IRON_TRACK — Schéma Supabase
-- À coller dans Supabase Studio > SQL Editor

-- ─────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- USERS
-- Étend auth.users de Supabase (même id UUID)
-- ─────────────────────────────────────────────
create table public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  name          text,
  level         text check (level in ('débutant', 'intermédiaire', 'avancé')),
  goal          text check (goal in ('force', 'hypertrophie', 'endurance')),
  equipment     text check (equipment in ('haltères', 'barre', 'machines', 'bodyweight', 'complet')),
  expert_mode   boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users: own row only"
  on public.users for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─────────────────────────────────────────────
-- EXERCISES
-- Bibliothèque partagée (pas d'owner)
-- ─────────────────────────────────────────────
create table public.exercises (
  id               uuid primary key default uuid_generate_v4(),
  name             text not null unique,
  muscle_group     text,
  equipment_needed text
);

alter table public.exercises enable row level security;

create policy "exercises: read by all authenticated"
  on public.exercises for select
  using (auth.role() = 'authenticated');

-- ─────────────────────────────────────────────
-- PROGRAMS
-- ─────────────────────────────────────────────
create table public.programs (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.users(id) on delete cascade,
  name           text not null,
  is_active      boolean not null default false,
  deload_active  boolean not null default false,
  deload_until   date,
  created_at     timestamptz not null default now()
);

alter table public.programs enable row level security;

create policy "programs: own only"
  on public.programs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index programs_user_id_idx on public.programs(user_id);

-- ─────────────────────────────────────────────
-- PROGRAM_DAYS
-- ─────────────────────────────────────────────
create table public.program_days (
  id           uuid primary key default uuid_generate_v4(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  day_order    int not null,
  name         text not null,
  rest_seconds int not null default 90,
  weekdays     text
);

alter table public.program_days enable row level security;

create policy "program_days: via program owner"
  on public.program_days for all
  using (
    exists (
      select 1 from public.programs p
      where p.id = program_days.program_id
        and p.user_id = auth.uid()
    )
  );

create index program_days_program_id_idx on public.program_days(program_id);

-- ─────────────────────────────────────────────
-- PROGRAM_EXERCISES
-- ─────────────────────────────────────────────
create table public.program_exercises (
  id                   uuid primary key default uuid_generate_v4(),
  program_day_id       uuid not null references public.program_days(id) on delete cascade,
  exercise_id          uuid not null references public.exercises(id),
  sets                 int not null default 3,
  reps_min             int not null,
  reps_max             int not null,
  weight_kg            float not null default 0,
  progression_type     text not null check (progression_type in ('double', 'linear', 'rep_per_session')),
  progression_value    float not null default 2.5,
  current_target_reps  int[] not null default '{}',
  order_index          int not null default 0,
  rir_target           int,
  tempo                text,
  notes                text,
  video_url            text,
  indications          text,
  machine_settings     text
);

alter table public.program_exercises enable row level security;

create policy "program_exercises: via program owner"
  on public.program_exercises for all
  using (
    exists (
      select 1
      from public.program_days pd
      join public.programs p on p.id = pd.program_id
      where pd.id = program_exercises.program_day_id
        and p.user_id = auth.uid()
    )
  );

create index program_exercises_day_id_idx on public.program_exercises(program_day_id);
create index program_exercises_exercise_id_idx on public.program_exercises(exercise_id);

-- ─────────────────────────────────────────────
-- SESSIONS
-- ─────────────────────────────────────────────
create table public.sessions (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references public.users(id) on delete cascade,
  program_day_id   uuid not null references public.program_days(id),
  done_at          timestamptz not null default now(),
  duration_seconds int
);

alter table public.sessions enable row level security;

create policy "sessions: own only"
  on public.sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index sessions_user_id_idx on public.sessions(user_id);
create index sessions_done_at_idx on public.sessions(done_at desc);
create index sessions_program_day_id_idx on public.sessions(program_day_id);

-- ─────────────────────────────────────────────
-- SESSION_SETS
-- ─────────────────────────────────────────────
create table public.session_sets (
  id                   uuid primary key default uuid_generate_v4(),
  session_id           uuid not null references public.sessions(id) on delete cascade,
  program_exercise_id  uuid not null references public.program_exercises(id),
  set_number           int not null,
  reps_done            int,
  weight_done_kg       float,
  completed            boolean not null default false
);

alter table public.session_sets enable row level security;

create policy "session_sets: via session owner"
  on public.session_sets for all
  using (
    exists (
      select 1 from public.sessions s
      where s.id = session_sets.session_id
        and s.user_id = auth.uid()
    )
  );

create index session_sets_session_id_idx on public.session_sets(session_id);
create index session_sets_program_exercise_id_idx on public.session_sets(program_exercise_id);

-- ─────────────────────────────────────────────
-- PERSONAL_RECORDS
-- ─────────────────────────────────────────────
create table public.personal_records (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.users(id) on delete cascade,
  exercise_id     uuid not null references public.exercises(id),
  weight_kg       float not null,
  reps            int not null,
  estimated_1rm   float generated always as (weight_kg * (1 + reps::float / 30)) stored,
  achieved_at     timestamptz not null default now(),
  session_set_id  uuid references public.session_sets(id) on delete set null,
  is_manual       boolean not null default false
);

alter table public.personal_records enable row level security;

create policy "personal_records: own only"
  on public.personal_records for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index personal_records_user_exercise_idx on public.personal_records(user_id, exercise_id);
create index personal_records_achieved_at_idx on public.personal_records(achieved_at desc);

-- ─────────────────────────────────────────────
-- MEASUREMENTS
-- typed-row model: one row per measurement type
-- type: 'poids' | 'tour_bras_g' | 'tour_bras_d' | 'tour_poitrine' | 'tour_taille' | 'tour_hanches'
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- TRIGGER : création automatique du profil user
-- Se déclenche après inscription via Supabase Auth
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.users (id, email, name, level, goal, equipment)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'level',
    new.raw_user_meta_data->>'goal',
    new.raw_user_meta_data->>'equipment'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
