import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Exercise } from '../types/database';

export function useExerciseLibrary() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('exercises')
      .select('*')
      .order('muscle_group', { ascending: true })
      .order('name', { ascending: true })
      .then(({ data }) => {
        setExercises((data as Exercise[]) ?? []);
        setLoading(false);
      });
  }, []);

  return { exercises, loading };
}
