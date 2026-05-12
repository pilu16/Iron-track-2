import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatVolume(v: number): string {
  return Math.round(v).toLocaleString('fr-FR');
}

function calc1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

const DAY_SHORT_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

interface SetDetail {
  id: string;
  setNumber: number;
  weightKg: number | null;
  repsDone: number | null;
  completed: boolean;
  estimated1rm: number | null;
  isPR: boolean;
}

interface ExerciseGroup {
  programExerciseId: string;
  orderIndex: number;
  exerciseName: string;
  muscleGroup: string | null;
  sets: SetDetail[];
}

interface SessionDetail {
  id: string;
  doneAt: Date;
  durationSeconds: number | null;
  programDayName: string;
  exercises: ExerciseGroup[];
  totalSets: number;
  totalVolume: number;
}

export default function SessionDetailScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadSession();
    return () => {
      isMountedRef.current = false;
    };
  }, [sessionId]);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const { data: raw, error } = await supabase
        .from('sessions')
        .select(`
          id,
          done_at,
          duration_seconds,
          program_days!inner ( name ),
          session_sets (
            id,
            set_number,
            reps_done,
            weight_done_kg,
            completed,
            program_exercise_id,
            program_exercises!inner (
              order_index,
              exercise:exercises ( name, muscle_group )
            )
          )
        `)
        .eq('id', sessionId)
        .single();

      if (error || !raw || !isMountedRef.current) return;

      const allSets: any[] = raw.session_sets ?? [];

      const uniquePEIds: string[] = Array.from(
        new Set(allSets.map((ss: any) => ss.program_exercise_id as string))
      );

      const maxResults = await Promise.all(
        uniquePEIds.map((peId) =>
          supabase
            .from('session_sets')
            .select('weight_done_kg, reps_done')
            .eq('program_exercise_id', peId)
            .eq('completed', true)
            .not('weight_done_kg', 'is', null)
            .not('reps_done', 'is', null)
        )
      );

      const globalMax1rmByPE = new Map<string, number>();
      uniquePEIds.forEach((peId, idx) => {
        const rows: any[] = maxResults[idx].data ?? [];
        const max = rows.reduce((best: number, row: any) => {
          const est = calc1RM(row.weight_done_kg as number, row.reps_done as number);
          return est > best ? est : best;
        }, 0);
        globalMax1rmByPE.set(peId, max);
      });

      const groupMap = new Map<string, ExerciseGroup>();
      for (const ss of allSets) {
        const peId: string = ss.program_exercise_id;
        if (!groupMap.has(peId)) {
          groupMap.set(peId, {
            programExerciseId: peId,
            orderIndex: ss.program_exercises?.order_index ?? 0,
            exerciseName: (ss.program_exercises?.exercise?.name ?? '').toUpperCase(),
            muscleGroup: ss.program_exercises?.exercise?.muscle_group ?? null,
            sets: [],
          });
        }
        const group = groupMap.get(peId)!;
        const estimated1rm =
          ss.weight_done_kg != null && ss.reps_done != null
            ? calc1RM(ss.weight_done_kg as number, ss.reps_done as number)
            : null;

        group.sets.push({
          id: ss.id,
          setNumber: ss.set_number,
          weightKg: ss.weight_done_kg,
          repsDone: ss.reps_done,
          completed: ss.completed,
          estimated1rm,
          isPR: false,
        });
      }

      const exerciseGroups: ExerciseGroup[] = Array.from(groupMap.values())
        .sort((a, b) => a.orderIndex - b.orderIndex);

      for (const group of exerciseGroups) {
        group.sets.sort((a, b) => a.setNumber - b.setNumber);

        const globalMax = globalMax1rmByPE.get(group.programExerciseId) ?? 0;

        if (globalMax > 0) {
          let localMax = 0;
          for (const set of group.sets) {
            if (set.estimated1rm != null && set.estimated1rm > localMax) {
              localMax = set.estimated1rm;
            }
          }
          for (const set of group.sets) {
            if (
              set.estimated1rm != null &&
              Math.abs(set.estimated1rm - localMax) < 0.001 &&
              Math.abs(set.estimated1rm - globalMax) < 0.001
            ) {
              set.isPR = true;
              break;
            }
          }
        }
      }

      const completedSets = allSets.filter((ss: any) => ss.completed);
      const totalSets = completedSets.length;
      const totalVolume = completedSets.reduce((acc: number, ss: any) => {
        if (ss.weight_done_kg != null && ss.reps_done != null) {
          return acc + (ss.weight_done_kg as number) * (ss.reps_done as number);
        }
        return acc;
      }, 0);

      if (isMountedRef.current) {
        setSession({
          id: raw.id,
          doneAt: new Date(raw.done_at),
          durationSeconds: raw.duration_seconds,
          programDayName: (raw.program_days?.name ?? '').toUpperCase(),
          exercises: exerciseGroups,
          totalSets,
          totalVolume,
        });
      }
    } catch {
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [sessionId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>SÉANCE INTROUVABLE.</Text>
      </View>
    );
  }

  const dayNum = String(session.doneAt.getDate()).padStart(2, '0');
  const monthNum = String(session.doneAt.getMonth() + 1).padStart(2, '0');
  const dayShort = DAY_SHORT_FR[session.doneAt.getDay()];
  const durationStr =
    session.durationSeconds != null ? formatDuration(session.durationSeconds) : '—';

  const totalExercisesWithSets = session.exercises.filter(
    (ex) => ex.sets.some((s) => s.completed)
  ).length;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← RETOUR</Text>
      </TouchableOpacity>

      <Text style={styles.sessionTitle}>{session.programDayName}</Text>
      <Text style={styles.sessionSubtitle}>
        {`${dayShort} · ${dayNum}.${monthNum} · ${durationStr}`}
      </Text>

      <View style={styles.divider} />

      <View style={styles.statsStrip}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>SÉRIES</Text>
          <Text style={styles.statValue}>{session.totalSets}</Text>
        </View>
        <View style={styles.statCellDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>VOL.</Text>
          <Text style={[styles.statValue, { color: ACCENT }]}>
            {formatVolume(session.totalVolume)} KG
          </Text>
        </View>
        <View style={styles.statCellDivider} />
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>DURÉE</Text>
          <Text style={styles.statValue}>{durationStr}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {session.exercises
        .filter((ex) => ex.sets.some((s) => s.completed))
        .map((ex, exIdx) => (
          <View key={ex.programExerciseId} style={styles.exerciseBlock}>
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseHeaderLeft}>
                <Text style={styles.exerciseIndex}>
                  {`EX ${String(exIdx + 1).padStart(2, '0')}/${String(totalExercisesWithSets).padStart(2, '0')}`}
                </Text>
                <Text style={styles.exerciseName}>{ex.exerciseName}</Text>
              </View>
              {ex.muscleGroup != null && (
                <Text style={styles.muscleGroup}>{ex.muscleGroup.toUpperCase()}</Text>
              )}
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colSet]}>#</Text>
              <Text style={styles.tableDot}> · </Text>
              <Text style={[styles.tableHeaderCell, styles.colKg]}>KG</Text>
              <Text style={styles.tableDot}> · </Text>
              <Text style={[styles.tableHeaderCell, styles.colReps]}>REPS</Text>
              <Text style={styles.tableDot}> · </Text>
              <Text style={[styles.tableHeaderCell, styles.col1rm]}>1RM EST.</Text>
            </View>

            {ex.sets
              .filter((s) => s.completed)
              .map((set) => (
                <View key={set.id} style={styles.setRow}>
                  <Text style={[styles.setCell, styles.colSet]}>
                    {String(set.setNumber).padStart(2, '0')}
                  </Text>
                  <Text style={styles.tableDot}> · </Text>
                  <Text style={[styles.setCell, styles.colKg]}>
                    {set.weightKg != null ? set.weightKg.toString() : '—'}
                  </Text>
                  <Text style={styles.tableDot}> · </Text>
                  <Text style={[styles.setCell, styles.colReps]}>
                    {set.repsDone != null ? set.repsDone.toString() : '—'}
                  </Text>
                  <Text style={styles.tableDot}> · </Text>
                  <View style={[styles.col1rm, styles.oneRMCell]}>
                    <Text style={styles.setCell}>
                      {set.estimated1rm != null ? set.estimated1rm.toFixed(1) : '—'}
                    </Text>
                    {set.isPR && (
                      <View style={styles.prBadge}>
                        <Text style={styles.prBadgeText}>PR</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
          </View>
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BACKGROUND },
  inner: { paddingTop: 56, paddingBottom: 60, paddingHorizontal: 16 },

  loadingContainer: {
    flex: 1,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 14,
    color: TEXT_SECONDARY,
    letterSpacing: 2,
  },

  backBtn: { marginBottom: 20 },
  backText: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: TEXT_SECONDARY,
    letterSpacing: 2,
  },

  sessionTitle: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 24,
    color: TEXT_PRIMARY,
    letterSpacing: 2,
    marginBottom: 6,
  },
  sessionSubtitle: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: TEXT_SECONDARY,
    letterSpacing: 2,
    marginBottom: 20,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 0,
  },

  statsStrip: {
    flexDirection: 'row',
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderTopWidth: 0,
    marginBottom: 24,
  },
  statCell: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 4,
  },
  statCellDivider: {
    width: 1,
    backgroundColor: BORDER,
    marginVertical: 10,
  },
  statLabel: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 2,
  },
  statValue: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 14,
    color: TEXT_PRIMARY,
    letterSpacing: 1,
  },

  exerciseBlock: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    borderRadius: 0,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  exerciseHeaderLeft: {
    gap: 2,
    flex: 1,
  },
  exerciseIndex: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 2,
  },
  exerciseName: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 14,
    color: TEXT_PRIMARY,
    letterSpacing: 1.5,
  },
  muscleGroup: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    paddingTop: 2,
  },

  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableHeaderCell: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
  },
  tableDot: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: BORDER,
  },

  colSet: { width: 24 },
  colKg: { width: 48 },
  colReps: { width: 40 },
  col1rm: { flex: 1 },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  setCell: {
    fontFamily: FONT_MONO_MEDIUM,
    fontSize: 12,
    color: TEXT_PRIMARY,
    letterSpacing: 1,
  },
  oneRMCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  prBadge: {
    backgroundColor: ACCENT,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 0,
  },
  prBadgeText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 8,
    color: BACKGROUND,
    letterSpacing: 1.5,
  },
});
