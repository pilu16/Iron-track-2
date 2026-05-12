import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import {
  ACCENT,
  BACKGROUND,
  BORDER,
  SURFACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../constants/colors';
import { FONT_MONO, FONT_MONO_BOLD, FONT_MONO_MEDIUM } from '../../constants/fonts';

type Period = '7J' | '4S' | '3M' | '12M' | 'TOUT';

const PERIOD_LABELS: Record<Period, string> = {
  '7J': '7 JOURS',
  '4S': '4 SEM',
  '3M': '3 MOIS',
  '12M': '12 MOIS',
  'TOUT': 'TOUT',
};

function periodToDays(p: Period): number | null {
  if (p === '7J') return 7;
  if (p === '4S') return 28;
  if (p === '3M') return 90;
  if (p === '12M') return 365;
  return null;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

interface SetRecord {
  weight_done_kg: number;
  reps_done: number;
  done_at: string;
  exercise_name: string;
  muscle_group: string | null;
}

interface WeekBar {
  label: string;
  volume: number;
}

interface OneRMRecord {
  exercise: string;
  max1rm: number;
  prev1rm: number;
}

interface MuscleShare {
  muscle: string;
  volume: number;
  pct: number;
}

interface StatsData {
  totalVolume: number;
  prevTotalVolume: number;
  weekBars: WeekBar[];
  oneRMs: OneRMRecord[];
  muscleShares: MuscleShare[];
}

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 100;
const LIFTS = ['COUCHÉ', 'SQUAT', 'SOULEVÉ', 'MILITAIRE'];
const LIFT_KEYWORDS = [
  ['couché', 'bench', 'développé'],
  ['squat'],
  ['soulevé', 'deadlift', 'sdt'],
  ['militaire', 'overhead', 'ohp'],
];

export default function StatsScreen() {
  const [period, setPeriod] = useState<Period>('4S');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const days = periodToDays(p);
      const cutoff = days ? new Date(Date.now() - days * 86400000).toISOString() : undefined;
      const prevCutoff = days
        ? new Date(Date.now() - days * 2 * 86400000).toISOString()
        : undefined;

      let query = supabase
        .from('session_sets')
        .select(`
          weight_done_kg,
          reps_done,
          sessions!inner(done_at, user_id),
          program_exercises!inner(exercise_id, exercises!inner(name, muscle_group))
        `)
        .eq('sessions.user_id', user.id)
        .eq('completed', true)
        .not('weight_done_kg', 'is', null)
        .not('reps_done', 'is', null);

      if (prevCutoff) {
        query = query.gte('sessions.done_at', prevCutoff);
      }

      const { data: rawSets } = await query.order('sessions.done_at', { ascending: true });

      const sets: SetRecord[] = (rawSets ?? []).map((s: any) => ({
        weight_done_kg: s.weight_done_kg as number,
        reps_done: s.reps_done as number,
        done_at: s.sessions.done_at as string,
        exercise_name: s.program_exercises.exercises.name as string,
        muscle_group: s.program_exercises.exercises.muscle_group as string | null,
      }));

      const periodStart = cutoff ? new Date(cutoff) : undefined;
      const periodSets = periodStart
        ? sets.filter((s) => new Date(s.done_at) >= periodStart)
        : sets;
      const prevSets = cutoff && prevCutoff
        ? sets.filter((s) => {
            const d = new Date(s.done_at);
            return d >= new Date(prevCutoff) && d < new Date(cutoff);
          })
        : [];

      const totalVolume = periodSets.reduce((a, s) => a + s.weight_done_kg * s.reps_done, 0);
      const prevTotalVolume = prevSets.reduce((a, s) => a + s.weight_done_kg * s.reps_done, 0);

      const weekVolumeMap = new Map<string, number>();
      for (const s of periodSets) {
        const d = new Date(s.done_at);
        const wk = getISOWeekNumber(d);
        const yr = d.getFullYear();
        const key = `${yr}-S${String(wk).padStart(2, '0')}`;
        weekVolumeMap.set(key, (weekVolumeMap.get(key) ?? 0) + s.weight_done_kg * s.reps_done);
      }

      const now = new Date();
      const numWeeks = Math.min(
        14,
        days ? Math.ceil(days / 7) : 14
      );
      const weekBars: WeekBar[] = [];
      for (let i = numWeeks - 1; i >= 0; i--) {
        const refDate = new Date(now);
        refDate.setDate(now.getDate() - i * 7);
        const wk = getISOWeekNumber(refDate);
        const yr = refDate.getFullYear();
        const key = `${yr}-S${String(wk).padStart(2, '0')}`;
        weekBars.push({ label: `S${String(wk).padStart(2, '0')}`, volume: weekVolumeMap.get(key) ?? 0 });
      }

      const oneRMs: OneRMRecord[] = LIFTS.map((label, li) => {
        const keywords = LIFT_KEYWORDS[li];
        const matching = sets.filter((s) =>
          keywords.some((kw) => s.exercise_name.toLowerCase().includes(kw))
        );
        const recent = periodSets.filter((s) =>
          keywords.some((kw) => s.exercise_name.toLowerCase().includes(kw))
        );
        const calc1rm = (arr: SetRecord[]) =>
          arr.reduce((best, s) => {
            const est = s.weight_done_kg * (1 + s.reps_done / 30.0);
            return est > best ? est : best;
          }, 0);
        const prevMatching = prevSets.filter((s) =>
          keywords.some((kw) => s.exercise_name.toLowerCase().includes(kw))
        );
        return {
          exercise: label,
          max1rm: calc1rm(recent.length > 0 ? recent : matching),
          prev1rm: calc1rm(prevMatching),
        };
      });

      const muscleVol = new Map<string, number>();
      for (const s of periodSets) {
        const mg = s.muscle_group ?? 'AUTRE';
        muscleVol.set(mg, (muscleVol.get(mg) ?? 0) + s.weight_done_kg * s.reps_done);
      }
      const totalMuscleVol = Array.from(muscleVol.values()).reduce((a, v) => a + v, 0);
      const muscleShares: MuscleShare[] = Array.from(muscleVol.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([muscle, volume]) => ({
          muscle: muscle.toUpperCase(),
          volume,
          pct: totalMuscleVol > 0 ? Math.round((volume / totalMuscleVol) * 100) : 0,
        }));

      if (isMountedRef.current) {
        setData({ totalVolume, prevTotalVolume, weekBars, oneRMs, muscleShares });
      }
    } catch {
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(period); }, [loadData, period]));

  function handlePeriod(p: Period) {
    setPeriod(p);
    loadData(p);
  }

  const maxBarVol = data ? Math.max(...data.weekBars.map((b) => b.volume), 1) : 1;
  const volumeChangePct =
    data && data.prevTotalVolume > 0
      ? ((data.totalVolume - data.prevTotalVolume) / data.prevTotalVolume) * 100
      : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
      <Text style={styles.sectionNum}>SECTION 03</Text>
      <Text style={styles.screenTitle}>STATISTIQUES.</Text>

      <View style={styles.periodRow}>
        {(['7J', '4S', '3M', '12M', 'TOUT'] as Period[]).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.periodBtn, period === p && styles.periodBtnActive]}
            onPress={() => handlePeriod(p)}
          >
            <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : data ? (
        <>
          <View style={styles.block}>
            <Text style={styles.blockLabel}>
              VOLUME TOTAL — {PERIOD_LABELS[period]}
            </Text>
            <View style={styles.volumeRow}>
              <Text style={styles.volumeNumber}>
                {Math.round(data.totalVolume).toLocaleString('fr-FR')}
                <Text style={styles.volumeUnit}> KG</Text>
              </Text>
              {volumeChangePct !== null && (
                <Text style={[styles.volumeDelta, { color: volumeChangePct >= 0 ? ACCENT : '#FF4A1F' }]}>
                  {volumeChangePct >= 0 ? '↑' : '↓'} {Math.abs(volumeChangePct).toFixed(1).replace('.', ',')}%
                </Text>
              )}
            </View>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockLabel}>TONNAGE HEBDOMADAIRE</Text>
            <View style={styles.chartContainer}>
              <View style={styles.barsRow}>
                {data.weekBars.map((bar, i) => {
                  const isLast = i === data.weekBars.length - 1;
                  const heightPct = bar.volume / maxBarVol;
                  const barH = Math.max(2, Math.round(heightPct * CHART_H));
                  return (
                    <View key={i} style={styles.barWrapper}>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: barH,
                              backgroundColor: isLast ? ACCENT : ACCENT + '66',
                            },
                          ]}
                        />
                      </View>
                      <Text style={styles.barLabel}>{bar.label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockLabel}>RECORDS 1RM ESTIMÉ</Text>
            <View style={styles.rmGrid}>
              {data.oneRMs.map((rec, i) => {
                const delta = rec.max1rm - rec.prev1rm;
                return (
                  <View key={i} style={styles.rmCard}>
                    <Text style={styles.rmExercise}>{rec.exercise}</Text>
                    <Text style={styles.rmValue}>
                      {rec.max1rm > 0 ? rec.max1rm.toFixed(1).replace('.', ',') : '—'}
                      {rec.max1rm > 0 && <Text style={styles.rmUnit}> KG</Text>}
                    </Text>
                    {rec.max1rm > 0 && rec.prev1rm > 0 && (
                      <Text style={styles.rmDelta}>
                        {delta >= 0 ? '↑' : '↓'} +{Math.abs(delta).toFixed(1).replace('.', ',')} KG
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          {data.muscleShares.length > 0 && (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>RÉPARTITION MUSCULAIRE</Text>
              {data.muscleShares.map((ms, i) => (
                <View key={i} style={styles.muscleRow}>
                  <Text style={styles.muscleName}>{ms.muscle}</Text>
                  <View style={styles.muscleBarTrack}>
                    <View style={[styles.muscleBarFill, { width: `${ms.pct}%` as any }]} />
                  </View>
                  <Text style={styles.musclePct}>{ms.pct}%</Text>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BACKGROUND },
  inner: { paddingTop: 56, paddingBottom: 40, paddingHorizontal: 16 },

  sectionNum: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 3, marginBottom: 4 },
  screenTitle: { fontFamily: FONT_MONO_BOLD, fontSize: 36, color: TEXT_PRIMARY, letterSpacing: 3, marginBottom: 24 },

  periodRow: { flexDirection: 'row', gap: 6, marginBottom: 24 },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  periodBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  periodBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 1.5 },
  periodBtnTextActive: { color: BACKGROUND },

  loadingBox: { flex: 1, paddingTop: 60, alignItems: 'center' },

  block: { marginBottom: 24, borderWidth: 1, borderColor: BORDER },
  blockLabel: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },

  volumeRow: { paddingHorizontal: 12, paddingVertical: 16, gap: 4 },
  volumeNumber: { fontFamily: FONT_MONO_BOLD, fontSize: 56, color: TEXT_PRIMARY, letterSpacing: 2 },
  volumeUnit: { fontFamily: FONT_MONO, fontSize: 20, color: TEXT_SECONDARY },
  volumeDelta: { fontFamily: FONT_MONO_BOLD, fontSize: 13, letterSpacing: 1 },

  chartContainer: { paddingHorizontal: 12, paddingTop: 16, paddingBottom: 8 },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_H + 24,
    gap: 3,
  },
  barWrapper: { flex: 1, alignItems: 'center' },
  barTrack: { flex: 1, justifyContent: 'flex-end', width: '100%', alignItems: 'center' },
  bar: { width: '100%' },
  barLabel: { fontFamily: FONT_MONO, fontSize: 7, color: TEXT_SECONDARY, marginTop: 4, letterSpacing: 0 },

  rmGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rmCard: {
    width: '50%',
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginTop: -1,
    marginLeft: -1,
  },
  rmExercise: { fontFamily: FONT_MONO, fontSize: 9, color: TEXT_SECONDARY, letterSpacing: 1.5, marginBottom: 6 },
  rmValue: { fontFamily: FONT_MONO_BOLD, fontSize: 24, color: TEXT_PRIMARY },
  rmUnit: { fontFamily: FONT_MONO, fontSize: 13, color: TEXT_SECONDARY },
  rmDelta: { fontFamily: FONT_MONO_MEDIUM, fontSize: 10, color: ACCENT, marginTop: 4, letterSpacing: 1 },

  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 10,
  },
  muscleName: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_PRIMARY, width: 100, letterSpacing: 1 },
  muscleBarTrack: { flex: 1, height: 6, backgroundColor: BORDER },
  muscleBarFill: { height: 6, backgroundColor: ACCENT },
  musclePct: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: ACCENT, width: 36, textAlign: 'right' },
});
