import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveProgram, findTodayDay } from '../../hooks/useActiveProgram';
import { supabase } from '../../lib/supabase';
import {
  BACKGROUND,
  ACCENT,
  HAZARD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  BORDER,
  SURFACE,
} from '../../constants/colors';
import { FONT_MONO_BOLD, FONT_MONO } from '../../constants/fonts';
import type { ProgramDay } from '../../types/database';

const ISO_DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const WEEKDAY_FR_MAP: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
};

function getISOWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function formatDateHeader(date: Date): string {
  const days = ['DIMANCHE', 'LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI'];
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${days[date.getDay()]} · ${d}.${m}`;
}

function daysAgo(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  return Math.floor((Date.now() - then) / 86400000);
}

function dayShortName(day: ProgramDay): string {
  const n = day.name.toUpperCase();
  if (n.includes('PUSH')) return 'PUSH';
  if (n.includes('PULL')) return 'PULL';
  if (n.includes('LEG') || n.includes('JAMB')) return 'LEGS';
  if (n.includes('UPPER')) return 'UPPER';
  if (n.includes('LOWER')) return 'LOWER';
  if (n.includes('FULL')) return 'FULL';
  if (n.includes('REPOS') || n.includes('REST')) return 'OFF';
  return n.slice(0, 4);
}

interface TodayData {
  userInitials: string;
  weekSessions: Array<{ program_day_id: string; done_at: string }>;
  weekVolume: number;
  streak: number;
  recentPRs: Array<{
    exercise_name: string;
    done_at: string;
    weight: number;
    reps: number;
    estimated_1rm: number;
  }>;
}

export default function TodayScreen() {
  const router = useRouter();
  const { program, loading: programLoading, refetch } = useActiveProgram();
  const [extraData, setExtraData] = useState<TodayData | null>(null);
  const [extraLoading, setExtraLoading] = useState(true);
  const [selectedDow, setSelectedDow] = useState<number | null>(null);
  const [manualDayId, setManualDayId] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const loadExtraData = useCallback(async () => {
    setExtraLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [userRes, sessionsRes, setsRes] = await Promise.all([
        supabase.from('users').select('name').eq('id', user.id).maybeSingle(),
        supabase
          .from('sessions')
          .select('program_day_id, done_at')
          .eq('user_id', user.id)
          .order('done_at', { ascending: false })
          .limit(60),
        supabase
          .from('session_sets')
          .select(`
            weight_done_kg,
            reps_done,
            program_exercise_id,
            session_id,
            sessions!inner(done_at, user_id),
            program_exercises!inner(exercise_id, exercises!inner(name))
          `)
          .eq('sessions.user_id', user.id)
          .eq('completed', true)
          .not('weight_done_kg', 'is', null)
          .not('reps_done', 'is', null)
          .order('weight_done_kg', { ascending: false })
          .limit(200),
      ]);

      const name: string = userRes.data?.name ?? '';
      const initials = name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w: string) => w[0].toUpperCase())
        .join('') || 'IT';

      const allSessions: Array<{ program_day_id: string; done_at: string }> =
        sessionsRes.data ?? [];

      const weekStart = getISOWeekStart(new Date());
      const weekSessions = allSessions.filter(
        (s) => new Date(s.done_at) >= weekStart
      );

      let streak = 0;
      const sessionsByDay = new Map<string, boolean>();
      for (const s of allSessions) {
        const key = new Date(s.done_at).toDateString();
        sessionsByDay.set(key, true);
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let checkDay = new Date(today);
      while (sessionsByDay.has(checkDay.toDateString())) {
        streak++;
        checkDay.setDate(checkDay.getDate() - 1);
      }

      const allSets = (setsRes.data ?? []) as Array<{
        weight_done_kg: number;
        reps_done: number;
        program_exercise_id: string;
        session_id: string;
        sessions: { done_at: string; user_id: string };
        program_exercises: { exercise_id: string; exercises: { name: string } };
      }>;

      const weekVolume = allSets
        .filter((s) => new Date(s.sessions.done_at) >= weekStart)
        .reduce((acc, s) => acc + s.weight_done_kg * s.reps_done, 0);

      const maxByExercise = new Map<string, number>();
      for (const s of allSets) {
        const est = s.weight_done_kg * (1 + s.reps_done / 30.0);
        const prev = maxByExercise.get(s.program_exercise_id) ?? 0;
        if (est > prev) maxByExercise.set(s.program_exercise_id, est);
      }

      const prs: TodayData['recentPRs'] = [];
      const seenExercise = new Set<string>();
      for (const s of allSets) {
        const est = s.weight_done_kg * (1 + s.reps_done / 30.0);
        const maxEst = maxByExercise.get(s.program_exercise_id) ?? 0;
        const exName = s.program_exercises.exercises.name;
        if (Math.abs(est - maxEst) < 0.01 && !seenExercise.has(s.program_exercise_id)) {
          seenExercise.add(s.program_exercise_id);
          prs.push({
            exercise_name: exName,
            done_at: s.sessions.done_at,
            weight: s.weight_done_kg,
            reps: s.reps_done,
            estimated_1rm: est,
          });
        }
        if (prs.length >= 3) break;
      }

      if (isMountedRef.current) {
        setExtraData({ userInitials: initials, weekSessions, weekVolume, streak, recentPRs: prs });
      }
    } catch {
    } finally {
      if (isMountedRef.current) setExtraLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refetch();
      loadExtraData();
      setSelectedDow(null);
      setManualDayId(null);
      setShowPicker(false);
    }, [refetch, loadExtraData])
  );

  const loading = programLoading || extraLoading;
  const now = new Date();
  const weekStart = getISOWeekStart(now);
  const todayDow = now.getDay();

  const todayDay = program ? findTodayDay(program.program_days) : null;

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  const programDayForDow = (dow: number): ProgramDay | null => {
    if (!program) return null;
    for (const d of program.program_days) {
      if (!d.weekdays) continue;
      const mapped = d.weekdays
        .split(',')
        .map((w) => WEEKDAY_FR_MAP[w.trim().toLowerCase()] ?? -1);
      if (mapped.includes(dow)) return d;
    }
    return null;
  };

  const manualDay = manualDayId
    ? (program?.program_days.find((d) => d.id === manualDayId) ?? null)
    : null;

  const displayDay = manualDay ?? (selectedDow !== null ? programDayForDow(selectedDow) : todayDay);

  const completedDayIds = new Set((extraData?.weekSessions ?? []).map((s) => s.program_day_id));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (!program) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.dateLabel}>{formatDateHeader(now)}</Text>
            <Text style={styles.mainTitle}>IRON_TRACK</Text>
          </View>
          <View style={styles.initialsBox}>
            <Text style={styles.initialsText}>{extraData?.userInitials ?? 'IT'}</Text>
          </View>
        </View>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>AUCUN PROGRAMME.</Text>
          <Text style={styles.emptyText}>Crée ton programme pour voir ta séance ici.</Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.push('/programme/create')}>
            <Text style={styles.ctaText}>CRÉER UN PROGRAMME →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const displayExercises = displayDay
    ? [...displayDay.program_exercises].sort((a, b) => a.order_index - b.order_index)
    : [];

  const muscleGroups = [
    ...new Set(displayExercises.map((e) => e.exercise.muscle_group).filter(Boolean)),
  ] as string[];

  const restSeconds = displayDay?.rest_seconds ?? 90;
  const totalSets = displayExercises.reduce((a, e) => a + e.sets, 0);
  const estimatedMin =
    Math.round(
      (displayExercises.reduce((a, e) => a + e.sets * restSeconds, 0) / 60) / 5
    ) * 5;

  const volumeCible = displayExercises.reduce((acc, e) => {
    const avgReps = (e.reps_min + e.reps_max) / 2;
    return acc + e.weight_kg * e.sets * avgReps;
  }, 0);

  const nextProgression =
    displayExercises.length > 0 ? displayExercises[0].progression_value : 0;

  const weekDone = extraData?.weekSessions.length ?? 0;
  const weekTotal = program.program_days.length;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
      {program.deload_active && (
        <View style={styles.deloadBanner}>
          <Text style={styles.deloadText}>! SEMAINE DE DÉCHARGE EN COURS</Text>
        </View>
      )}

      <View style={styles.headerRow}>
        <View>
          <Text style={styles.dateLabel}>{formatDateHeader(now)}</Text>
          <Text style={styles.mainTitle}>IRON_TRACK</Text>
        </View>
        <View style={styles.initialsBox}>
          <Text style={styles.initialsText}>{extraData?.userInitials ?? 'IT'}</Text>
        </View>
      </View>

      <View style={styles.weekRow}>
        {weekDays.map((date, i) => {
          const dow = date.getDay();
          const isToday = dow === todayDow && date.toDateString() === now.toDateString();
          const dayProgram = programDayForDow(dow);
          const isCompleted = dayProgram ? completedDayIds.has(dayProgram.id) : false;
          const hasSession = !!dayProgram;
          const isPast = date < now && !isToday;
          const isSelected = !isToday && selectedDow === dow;
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.7}
              onPress={() => {
                const newDow = selectedDow === dow ? null : dow;
                setSelectedDow(newDow);
                setManualDayId(null);
                if (newDow !== null && !programDayForDow(newDow)) setShowPicker(true);
                else setShowPicker(false);
              }}
              style={[
                styles.weekCell,
                isToday && styles.weekCellToday,
                isSelected && styles.weekCellSelected,
              ]}
            >
              <Text style={[styles.weekDayLetter, isToday && styles.weekDayLetterToday, isSelected && !isToday && styles.weekDayLetterSelected]}>
                {ISO_DAYS[dow]}
              </Text>
              {hasSession && (
                <Text style={[styles.weekSessionName, isToday && styles.weekSessionNameToday, isSelected && !isToday && styles.weekSessionNameSelected]}>
                  {dayShortName(dayProgram)}
                </Text>
              )}
              {hasSession && (
                <Text style={[styles.weekDot, isCompleted && styles.weekDotFilled]}>
                  {isCompleted ? '●' : isPast ? '○' : '·'}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {showPicker && !manualDay ? (
        <View style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>CHOISIR UNE SÉANCE</Text>
          {[...program.program_days]
            .sort((a, b) => a.day_order - b.day_order)
            .map((d) => (
              <TouchableOpacity
                key={d.id}
                style={styles.pickerOption}
                onPress={() => { setManualDayId(d.id); setShowPicker(false); }}
                activeOpacity={0.7}
              >
                <View style={styles.pickerOptionLeft}>
                  <Text style={styles.pickerOptionName}>{d.name.toUpperCase()}</Text>
                  <Text style={styles.pickerOptionMeta}>{d.program_exercises.length} EXOS</Text>
                </View>
                <Text style={styles.pickerChevron}>→</Text>
              </TouchableOpacity>
            ))}
        </View>
      ) : !displayDay ? (
        <View style={styles.restCard}>
          <Text style={styles.restTitle}>REPOS.</Text>
          <Text style={styles.restText}>Pas de séance prévue. Appuie sur un jour ou démarre une séance libre.</Text>
          <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowPicker(true)}>
            <Text style={styles.pickerTriggerText}>+ FAIRE UNE SÉANCE</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.todayCard}>
          <Text style={styles.todayLabel}>
            {manualDay || (selectedDow !== null && selectedDow !== todayDow)
              ? displayDay.name.toUpperCase()
              : "AUJOURD'HUI"}
          </Text>
          <Text style={styles.todaySessionName}>{displayDay.name.toUpperCase()}</Text>
          <Text style={styles.todaySubtitle}>
            {muscleGroups.map((m) => m.toUpperCase()).join(' / ')}
            {muscleGroups.length > 0 ? ' — ' : ''}
            {displayExercises.length} EXOS · ~{estimatedMin} MIN
          </Text>
          <View style={styles.todayStatsRow}>
            <View style={styles.todayStatCell}>
              <Text style={styles.todayStatLabel}>VOL. CIBLE</Text>
              <Text style={styles.todayStatValue}>
                {Math.round(volumeCible)}<Text style={styles.todayStatUnit}> KG</Text>
              </Text>
            </View>
            <View style={styles.todayStatDivider} />
            <View style={styles.todayStatCell}>
              <Text style={styles.todayStatLabel}>SÉRIES</Text>
              <Text style={styles.todayStatValue}>{totalSets}</Text>
            </View>
            <View style={styles.todayStatDivider} />
            <View style={styles.todayStatCell}>
              <Text style={styles.todayStatLabel}>1RM SUIV.</Text>
              <Text style={[styles.todayStatValue, { color: ACCENT }]}>
                +{nextProgression.toFixed(1).replace('.', ',')} KG
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => router.push(`/workout/${displayDay.id}`)}
            activeOpacity={0.85}
          >
            <Text style={styles.startBtnText}>▶ DÉMARRER LA SÉANCE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.changeSeanceBtn}
            onPress={() => { setManualDayId(null); setShowPicker(true); }}
          >
            <Text style={styles.changeSeanceBtnText}>CHANGER DE SÉANCE →</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.sectionBlock}>
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabelText}>SEMAINE EN COURS</Text>
        </View>
        <View style={styles.weekStatsRow}>
          <View style={styles.weekStatCell}>
            <Text style={styles.weekStatLabel}>SÉANCES</Text>
            <Text style={styles.weekStatValue}>
              {weekDone}
              <Text style={styles.weekStatDenom}>/{weekTotal}</Text>
            </Text>
          </View>
          <View style={styles.todayStatDivider} />
          <View style={styles.weekStatCell}>
            <Text style={styles.weekStatLabel}>VOLUME</Text>
            <Text style={styles.weekStatValue}>
              {Math.round((extraData?.weekVolume ?? 0) / 1000).toFixed(1).replace('.', ',')}
              <Text style={styles.weekStatUnit}> T</Text>
            </Text>
          </View>
          <View style={styles.todayStatDivider} />
          <View style={styles.weekStatCell}>
            <Text style={styles.weekStatLabel}>STREAK</Text>
            <Text style={styles.weekStatValue}>
              {extraData?.streak ?? 0}
              <Text style={styles.weekStatUnit}> J</Text>
            </Text>
          </View>
        </View>
      </View>

      {(extraData?.recentPRs ?? []).length > 0 && (
        <View style={styles.sectionBlock}>
          <View style={styles.sectionLabelRow}>
            <Text style={styles.sectionLabelText}>RECORDS RÉCENTS</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{extraData!.recentPRs.length}</Text>
            </View>
          </View>
          {extraData!.recentPRs.map((pr, i) => (
            <View key={i} style={styles.prRow}>
              <View style={styles.prLeft}>
                <Text style={styles.prName}>{pr.exercise_name.toUpperCase()}</Text>
                <Text style={styles.prDate}>IL Y A {daysAgo(pr.done_at)} J</Text>
              </View>
              <View style={styles.prRight}>
                <Text style={styles.prWeight}>
                  {pr.weight.toFixed(1).replace('.', ',')}
                  <Text style={styles.prUnit}> KG</Text>
                </Text>
                <Text style={styles.prReps}>× {pr.reps} REPS</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BACKGROUND },
  inner: { paddingTop: 56, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: BACKGROUND, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: BACKGROUND, paddingTop: 56 },

  deloadBanner: {
    backgroundColor: HAZARD + '22',
    borderLeftWidth: 3,
    borderLeftColor: HAZARD,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  deloadText: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: HAZARD, letterSpacing: 2 },

  headerRow: {
    paddingHorizontal: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateLabel: { fontFamily: FONT_MONO, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 2, marginBottom: 2 },
  mainTitle: { fontFamily: FONT_MONO_BOLD, fontSize: 28, color: TEXT_PRIMARY, letterSpacing: 3 },
  initialsBox: {
    width: 36,
    height: 36,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  initialsText: { fontFamily: FONT_MONO_BOLD, fontSize: 12, color: TEXT_PRIMARY, letterSpacing: 1 },

  weekRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  weekCell: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: BORDER,
  },
  weekCellToday: {
    borderWidth: 1,
    borderColor: TEXT_PRIMARY,
    marginTop: -1,
    marginBottom: -1,
  },
  weekCellSelected: {
    borderWidth: 1,
    borderColor: ACCENT,
    marginTop: -1,
    marginBottom: -1,
  },
  weekDayLetter: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 1 },
  weekDayLetterToday: { color: TEXT_PRIMARY },
  weekDayLetterSelected: { color: ACCENT },
  weekSessionName: { fontFamily: FONT_MONO, fontSize: 8, color: TEXT_SECONDARY, marginTop: 2, letterSpacing: 0.5 },
  weekSessionNameToday: { color: TEXT_PRIMARY },
  weekSessionNameSelected: { color: ACCENT },
  weekDot: { fontFamily: FONT_MONO, fontSize: 8, color: TEXT_SECONDARY, marginTop: 2 },
  weekDotFilled: { color: ACCENT },

  restCard: {
    marginHorizontal: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    gap: 8,
    marginBottom: 16,
  },
  restTitle: { fontFamily: FONT_MONO_BOLD, fontSize: 28, color: TEXT_PRIMARY, letterSpacing: 3 },
  restText: { fontFamily: FONT_MONO, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 1.5 },

  todayCard: {
    marginHorizontal: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: ACCENT,
    padding: 16,
    marginBottom: 16,
  },
  todayLabel: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 9,
    color: ACCENT,
    letterSpacing: 3,
    marginBottom: 6,
  },
  todaySessionName: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 28,
    color: TEXT_PRIMARY,
    letterSpacing: 2,
    marginBottom: 4,
  },
  todaySubtitle: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 1,
    marginBottom: 16,
  },
  todayStatsRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  todayStatCell: { flex: 1, paddingVertical: 10, paddingHorizontal: 8 },
  todayStatDivider: { width: 1, backgroundColor: BORDER },
  todayStatLabel: {
    fontFamily: FONT_MONO,
    fontSize: 8,
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  todayStatValue: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  todayStatUnit: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY },
  startBtn: { backgroundColor: ACCENT, paddingVertical: 16, alignItems: 'center' },
  startBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 13, color: BACKGROUND, letterSpacing: 3 },
  changeSeanceBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  changeSeanceBtnText: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 2 },

  pickerCard: {
    marginHorizontal: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  pickerTitle: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 3,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  pickerOptionLeft: { gap: 3 },
  pickerOptionName: { fontFamily: FONT_MONO_BOLD, fontSize: 14, color: TEXT_PRIMARY, letterSpacing: 1 },
  pickerOptionMeta: { fontFamily: FONT_MONO, fontSize: 9, color: TEXT_SECONDARY, letterSpacing: 1 },
  pickerChevron: { fontFamily: FONT_MONO_BOLD, fontSize: 16, color: ACCENT },
  pickerTrigger: {
    borderWidth: 1,
    borderColor: ACCENT,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  pickerTriggerText: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: ACCENT, letterSpacing: 2 },

  sectionBlock: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sectionLabelText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 3,
  },
  countBadge: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: ACCENT },

  weekStatsRow: { flexDirection: 'row' },
  weekStatCell: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  weekStatLabel: { fontFamily: FONT_MONO, fontSize: 8, color: TEXT_SECONDARY, letterSpacing: 1.5, marginBottom: 4 },
  weekStatValue: { fontFamily: FONT_MONO_BOLD, fontSize: 20, color: TEXT_PRIMARY },
  weekStatDenom: { fontFamily: FONT_MONO, fontSize: 14, color: TEXT_SECONDARY },
  weekStatUnit: { fontFamily: FONT_MONO, fontSize: 11, color: TEXT_SECONDARY },

  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  prLeft: { flex: 1, gap: 2 },
  prName: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: TEXT_PRIMARY, letterSpacing: 1 },
  prDate: { fontFamily: FONT_MONO, fontSize: 9, color: TEXT_SECONDARY, letterSpacing: 1 },
  prRight: { alignItems: 'flex-end', gap: 2 },
  prWeight: { fontFamily: FONT_MONO_BOLD, fontSize: 16, color: ACCENT },
  prUnit: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY },
  prReps: { fontFamily: FONT_MONO, fontSize: 9, color: TEXT_SECONDARY, letterSpacing: 1 },

  emptyCard: {
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    gap: 12,
  },
  emptyTitle: { fontFamily: FONT_MONO_BOLD, fontSize: 18, color: TEXT_PRIMARY, letterSpacing: 2 },
  emptyText: { fontFamily: FONT_MONO, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 1 },
  cta: { backgroundColor: ACCENT, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  ctaText: { fontFamily: FONT_MONO_BOLD, fontSize: 12, color: BACKGROUND, letterSpacing: 2 },
});
