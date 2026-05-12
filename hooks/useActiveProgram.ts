import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Program, ProgramDay } from '../types/database';

const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function getTodayFr(): string {
  return WEEKDAYS_FR[new Date().getDay()];
}

export function findTodayDay(days: ProgramDay[]): ProgramDay | null {
  const today = getTodayFr();
  return (
    days.find((d) =>
      d.weekdays
        ?.split(',')
        .map((w) => w.trim().toLowerCase())
        .includes(today)
    ) ?? null
  );
}

export function useActiveProgram() {
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from('programs')
      .select(
        `*, program_days(*, program_exercises(*, exercise:exercises(*)))`
      )
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) setError(fetchError.message);
    else setProgram(data as Program | null);

    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const todayDay = program ? findTodayDay(program.program_days) : null;

  return { program, todayDay, loading, error, refetch: fetch };
}
