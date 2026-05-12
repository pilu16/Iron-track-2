-- IRON_TRACK — Ajoute progression_type au niveau programme
-- Exécuter dans Supabase Studio > SQL Editor

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS progression_type text NOT NULL DEFAULT 'double'
  CHECK (progression_type IN ('double', 'linear', 'rep_per_session'));
