import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export type MeasurementType =
  | 'poids'
  | 'tour_bras_g'
  | 'tour_bras_d'
  | 'tour_poitrine'
  | 'tour_taille'
  | 'tour_hanches';

export interface MeasurementRow {
  id: string;
  user_id: string;
  type: MeasurementType;
  value: number;
  unit: string;
  measured_at: string;
}

export interface InsertMeasurementParams {
  type: MeasurementType;
  value: number;
  unit?: string;
}

export function useMeasurements() {
  const [measurements, setMeasurements] = useState<MeasurementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchMeasurements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: fetchErr } = await supabase
        .from('measurements')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: false })
        .limit(200);

      if (fetchErr) throw fetchErr;
      if (isMountedRef.current) {
        setMeasurements((data ?? []) as MeasurementRow[]);
      }
    } catch (e: unknown) {
      if (isMountedRef.current) {
        setError(e instanceof Error ? e.message : 'Erreur inconnue');
      }
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeasurements();
  }, [fetchMeasurements]);

  const insertMeasurement = useCallback(
    async (params: InsertMeasurementParams): Promise<MeasurementRow | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const unit = params.unit ?? (params.type === 'poids' ? 'kg' : 'cm');

      const { data, error: insertErr } = await supabase
        .from('measurements')
        .insert({
          user_id: user.id,
          type: params.type,
          value: params.value,
          unit,
          measured_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const row = data as MeasurementRow;
      if (isMountedRef.current) {
        setMeasurements((prev) => [row, ...prev]);
      }
      return row;
    },
    []
  );

  return {
    measurements,
    loading,
    error,
    refetch: fetchMeasurements,
    insertMeasurement,
  };
}
