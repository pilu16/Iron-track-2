import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import {
  ACCENT,
  BACKGROUND,
  BORDER,
  HAZARD,
  SURFACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../constants/colors';
import { FONT_MONO, FONT_MONO_BOLD, FONT_MONO_MEDIUM } from '../../constants/fonts';

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatVolume(v: number): string {
  return Math.round(v).toLocaleString('fr-FR');
}

const DAY_SHORT_FR = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM'];

interface SessionCard {
  id: string;
  doneAt: Date;
  name: string;
  durationStr: string;
  totalExercises: number;
  totalSets: number;
  muscleGroups: string[];
  volume: number;
}

interface WeekGroup {
  weekNumber: number;
  weekVolume: number;
  sessions: SessionCard[];
}

export default function JournalScreen() {
  const router = useRouter();
  const [weeks, setWeeks] = useState<WeekGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: raw } = await supabase
        .from('sessions')
        .select(`
          id,
          done_at,
          duration_seconds,
          program_day_id,
          program_days!inner (
            name,
            program_exercises (
              id,
              exercise:exercises ( muscle_group )
            )
          ),
          session_sets ( weight_done_kg, reps_done, completed )
        `)
        .eq('user_id', user.id)
        .order('done_at', { ascending: false })
        .limit(100);

      if (!isMountedRef.current) return;

      const sessions: SessionCard[] = (raw ?? []).map((s: any) => {
        const sets: any[] = s.session_sets ?? [];
        const completedSets = sets.filter((ss: any) => ss.completed);
        const volume = completedSets.reduce((acc: number, ss: any) => {
          if (ss.weight_done_kg != null && ss.reps_done != null) {
            return acc + ss.weight_done_kg * ss.reps_done;
          }
          return acc;
        }, 0);

        const programExercises: any[] = s.program_days?.program_exercises ?? [];
        const totalExercises = programExercises.length;

        const muscleGroups: string[] = Array.from(
          new Set(
            programExercises
              .map((pe: any) => pe.exercise?.muscle_group)
              .filter((mg: string | null) => mg != null) as string[]
          )
        );

        const durationStr =
          s.duration_seconds != null ? formatDuration(s.duration_seconds) : '—';

        return {
          id: s.id,
          doneAt: new Date(s.done_at),
          name: (s.program_days?.name ?? '').toUpperCase(),
          durationStr,
          totalExercises,
          totalSets: completedSets.length,
          muscleGroups,
          volume,
        };
      });

      const weekMap = new Map<string, WeekGroup>();
      for (const session of sessions) {
        const wk = getISOWeekNumber(session.doneAt);
        const yr = session.doneAt.getFullYear();
        const key = `${yr}-${wk}`;
        if (!weekMap.has(key)) {
          weekMap.set(key, { weekNumber: wk, weekVolume: 0, sessions: [] });
        }
        const group = weekMap.get(key)!;
        group.sessions.push(session);
        group.weekVolume += session.volume;
      }

      const weekGroups = Array.from(weekMap.values());

      if (isMountedRef.current) {
        setWeeks(weekGroups);
      }
    } catch {
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, []);

  function deleteSession(sessionId: string) {
    Alert.alert(
      'SUPPRIMER LA SÉANCE',
      'Cette séance sera définitivement supprimée.',
      [
        { text: 'ANNULER', style: 'cancel' },
        {
          text: 'SUPPRIMER',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('session_sets').delete().eq('session_id', sessionId);
            await supabase.from('sessions').delete().eq('id', sessionId);
            loadSessions();
          },
        },
      ]
    );
  }

  useFocusEffect(
    useCallback(() => {
      isMountedRef.current = true;
      loadSessions();
      return () => {
        isMountedRef.current = false;
      };
    }, [loadSessions])
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
      <Text style={styles.sectionNum}>SECTION 02</Text>
      <Text style={styles.screenTitle}>JOURNAL.</Text>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : weeks.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>AUCUNE SÉANCE.</Text>
          <Text style={styles.emptySubtitle}>
            Lance ta première séance depuis l'onglet TODAY.
          </Text>
        </View>
      ) : (
        weeks.map((week) => (
          <View key={`${week.weekNumber}`} style={styles.weekGroup}>
            <View style={styles.weekHeader}>
              <Text style={styles.weekHeaderText}>
                {`SEMAINE ${String(week.weekNumber).padStart(2, '0')} — VOL. ${formatVolume(week.weekVolume)} KG`}
              </Text>
            </View>

            {week.sessions.map((session) => {
              const dayNum = session.doneAt.getDate();
              const dayShort = DAY_SHORT_FR[session.doneAt.getDay()];
              const monthStr = String(session.doneAt.getMonth() + 1).padStart(2, '0');

              return (
                <View key={session.id} style={styles.card}>
                  <View style={styles.accentBorder} />

                  <TouchableOpacity
                    style={styles.cardMain}
                    onPress={() => router.push(`/journal/${session.id}` as any)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.dateCol}>
                      <Text style={styles.dateDayNum}>
                        {String(dayNum).padStart(2, '0')}
                      </Text>
                      <Text style={styles.dateDayShort}>{dayShort}</Text>
                    </View>

                    <View style={styles.separator} />

                    <View style={styles.mainCol}>
                      <Text style={styles.sessionName} numberOfLines={1}>
                        {session.name}
                      </Text>
                      <Text style={styles.sessionMeta}>
                        {`${session.totalExercises} EXOS · ${session.totalSets} SÉRIES`}
                      </Text>
                      {session.muscleGroups.length > 0 && (
                        <Text style={styles.sessionMuscles} numberOfLines={1}>
                          {session.muscleGroups.map((mg) => mg.toUpperCase()).join(' · ')}
                        </Text>
                      )}
                    </View>

                    <View style={styles.rightCol}>
                      <Text style={styles.rightDuration}>{session.durationStr}</Text>
                      <Text style={styles.rightVolume}>
                        {`VOL. ${formatVolume(session.volume)} KG`}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteCol}
                    onPress={() => deleteSession(session.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.deleteColText}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BACKGROUND },
  inner: { paddingTop: 56, paddingBottom: 40, paddingHorizontal: 16 },

  sectionNum: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 3,
    marginBottom: 4,
  },
  screenTitle: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 36,
    color: TEXT_PRIMARY,
    letterSpacing: 3,
    marginBottom: 24,
  },

  loadingBox: { paddingTop: 60, alignItems: 'center' },

  emptyBox: { paddingTop: 60, alignItems: 'center', gap: 12 },
  emptyTitle: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 24,
    color: TEXT_PRIMARY,
    letterSpacing: 2,
  },
  emptySubtitle: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    letterSpacing: 1,
    lineHeight: 18,
  },

  weekGroup: { marginBottom: 24 },
  weekHeader: {
    paddingVertical: 8,
    paddingHorizontal: 0,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  weekHeaderText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 2,
  },

  card: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    flexDirection: 'row',
    marginBottom: 4,
    borderRadius: 0,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
  },
  deleteCol: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: BORDER,
  },
  deleteColText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 12,
    color: HAZARD,
  },
  accentBorder: {
    width: 3,
    backgroundColor: ACCENT,
  },
  dateCol: {
    width: 48,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dateDayNum: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 20,
    color: ACCENT,
    letterSpacing: 1,
  },
  dateDayShort: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
  },
  separator: {
    width: 1,
    backgroundColor: BORDER,
    marginVertical: 8,
  },
  mainCol: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 3,
    justifyContent: 'center',
  },
  sessionName: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 13,
    color: TEXT_PRIMARY,
    letterSpacing: 1.5,
  },
  sessionMeta: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 1,
  },
  sessionMuscles: {
    fontFamily: FONT_MONO,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 1,
    marginTop: 2,
  },
  rightCol: {
    paddingVertical: 12,
    paddingRight: 12,
    paddingLeft: 8,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  rightDuration: {
    fontFamily: FONT_MONO_MEDIUM,
    fontSize: 12,
    color: TEXT_PRIMARY,
    letterSpacing: 1,
  },
  rightVolume: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 10,
    color: ACCENT,
    letterSpacing: 1,
  },
});
