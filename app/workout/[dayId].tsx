import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { supabase } from '../../lib/supabase';
import { computeNextTargets } from '../../lib/progression';
import type { SessionSet as ProgressionSessionSet, ProgressionUpdate } from '../../lib/progression';
import type { ProgramDay, ProgramExerciseRow } from '../../types/database';
import {
  ACCENT,
  BACKGROUND,
  BORDER,
  HAZARD,
  SURFACE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../constants/colors';
import {
  FONT_MONO,
  FONT_MONO_BOLD,
  FONT_MONO_MEDIUM,
} from '../../constants/fonts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SetDraft {
  weightInput: string;
  repsInput: string;
  completed: boolean;
  dbId: string | null;
}

interface ExerciseState {
  programExercise: ProgramExerciseRow;
  sets: SetDraft[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Sub-component: Set Row
// ---------------------------------------------------------------------------

interface SetRowProps {
  index: number;
  draft: SetDraft;
  targetReps: number;
  targetWeight: number;
  onWeightChange: (val: string) => void;
  onRepsChange: (val: string) => void;
  onConfirm: () => void;
}

const SetRow = React.memo(function SetRow({
  index,
  draft,
  targetReps,
  targetWeight,
  onWeightChange,
  onRepsChange,
  onConfirm,
}: SetRowProps) {
  const isActive = !draft.completed;
  const repsRef = useRef<TextInput>(null);

  function tryAutoConfirm(weight: string, reps: string) {
    if (weight.trim() && reps.trim() && !draft.completed) onConfirm();
  }

  const targetMet: boolean | null = draft.completed
    ? (() => {
        const r = parseInt(draft.repsInput, 10);
        const w = parseFloat(draft.weightInput);
        return !isNaN(r) && !isNaN(w) && r >= targetReps && w >= targetWeight;
      })()
    : null;

  return (
    <View
      style={[
        styles.setRow,
        draft.completed && styles.setRowCompleted,
        isActive && styles.setRowActive,
      ]}
    >
      <Text style={styles.setIndexText}>{index + 1}</Text>

      <Text style={[
        styles.setObjectifText,
        !draft.completed && styles.setObjectifGhost,
        targetMet === true && styles.setObjectifMet,
        targetMet === false && styles.setObjectifMissed,
      ]}>
        {targetReps}×{targetWeight}KG
      </Text>

      {/* KG */}
      <TextInput
        style={[styles.setInput, draft.completed && styles.setInputCompleted]}
        value={draft.weightInput}
        onChangeText={onWeightChange}
        keyboardType="decimal-pad"
        selectTextOnFocus
        editable={!draft.completed}
        placeholderTextColor={TEXT_SECONDARY}
        placeholder={String(targetWeight)}
        returnKeyType="next"
        onSubmitEditing={() => repsRef.current?.focus()}
      />

      {/* REPS */}
      <TextInput
        ref={repsRef}
        style={[styles.setInput, draft.completed && styles.setInputCompleted]}
        value={draft.repsInput}
        onChangeText={onRepsChange}
        keyboardType="number-pad"
        selectTextOnFocus
        editable={!draft.completed}
        placeholderTextColor={TEXT_SECONDARY}
        placeholder={String(targetReps)}
        returnKeyType="done"
        onSubmitEditing={() => tryAutoConfirm(draft.weightInput, draft.repsInput)}
        onEndEditing={() => tryAutoConfirm(draft.weightInput, draft.repsInput)}
      />

      {/* Confirm button */}
      <TouchableOpacity
        onPress={onConfirm}
        disabled={draft.completed}
        style={[styles.confirmBtn, draft.completed && styles.confirmBtnDone]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.confirmBtnText, draft.completed && styles.confirmBtnTextDone]}>
          {draft.completed ? '✓' : '→'}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Sub-component: Exercise Card
// ---------------------------------------------------------------------------

interface ExerciseCardProps {
  exState: ExerciseState;
  onSetWeightChange: (setIndex: number, val: string) => void;
  onSetRepsChange: (setIndex: number, val: string) => void;
  onConfirmSet: (setIndex: number) => void;
}

const ExerciseCard = React.memo(function ExerciseCard({
  exState,
  onSetWeightChange,
  onSetRepsChange,
  onConfirmSet,
}: ExerciseCardProps) {
  const { programExercise, sets } = exState;
  const ex = programExercise.exercise;

  return (
    <View style={styles.card}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <Text style={styles.exerciseName}>{ex.name.toUpperCase()}</Text>
        {ex.muscle_group != null && (
          <Text style={styles.muscleLabel}>
            {ex.muscle_group.toUpperCase()}
          </Text>
        )}
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.colIndex]}>#</Text>
        <Text style={[styles.tableHeaderCell, styles.colObjectif]}>
          OBJECTIF
        </Text>
        <Text style={[styles.tableHeaderCell, styles.colInput]}>KG</Text>
        <Text style={[styles.tableHeaderCell, styles.colInput]}>REPS</Text>
        <View style={styles.colConfirm} />
      </View>

      {/* Set rows */}
      {sets.map((draft, i) => (
        <SetRow
          key={i}
          index={i}
          draft={draft}
          targetReps={programExercise.current_target_reps[i] ?? programExercise.reps_min}
          targetWeight={programExercise.weight_kg}
          onWeightChange={(val) => onSetWeightChange(i, val)}
          onRepsChange={(val) => onSetRepsChange(i, val)}
          onConfirm={() => onConfirmSet(i)}
        />
      ))}
    </View>
  );
});

// ---------------------------------------------------------------------------
// Sub-component: Rest Timer Strip (bottom)
// ---------------------------------------------------------------------------

interface RestTimerProps {
  remaining: number;
  total: number;
  nextSetInfo: string;
  onSkip: () => void;
  bottomOffset: number;
}

function RestTimerStrip({ remaining, total, nextSetInfo, onSkip, bottomOffset }: RestTimerProps) {
  const progress = total > 0 ? 1 - remaining / total : 0;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

  return (
    <View style={[styles.restStrip, { bottom: bottomOffset }]}>
      <View style={styles.restStripInner}>
        <View style={styles.restTimeBox}>
          <Text style={styles.restTimeValue}>{timeStr}</Text>
          <Text style={styles.restTimeLabel}>REPOS</Text>
        </View>
        <Text style={styles.restNextInfo} numberOfLines={1}>{nextSetInfo}</Text>
        <TouchableOpacity
          onPress={onSkip}
          style={styles.restSkipBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.restSkipBtnText}>SKIP</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.restProgressTrack}>
        <View style={[styles.restProgressFill, { width: `${progress * 100}%` as any }]} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function WorkoutScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // --- Data state ---
  const [day, setDay] = useState<ProgramDay | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [exerciseStates, setExerciseStates] = useState<ExerciseState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- Elapsed timer ---
  const startTimeRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  // --- Rest timer ---
  const [restRemaining, setRestRemaining] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Finish confirmation ---
  const [confirmingFinish, setConfirmingFinish] = useState(false);

  // --- Guard against double-fire from onEndEditing + onSubmitEditing ---
  const pendingConfirms = useRef(new Set<string>());

  // --- Elapsed interval ---
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ---------------------------------------------------------------------------
  // Mount: fetch day + create session
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!dayId) return;

    let cancelled = false;

    async function init() {
      try {
        // 1. Fetch program day with exercises
        const { data: dayData, error: dayErr } = await supabase
          .from('program_days')
          .select('*, program_exercises(*, exercise:exercises(*))')
          .eq('id', dayId)
          .single();

        if (dayErr) throw dayErr;
        if (cancelled) return;

        // Sort exercises by order_index
        const sortedDay: ProgramDay = {
          ...dayData,
          program_exercises: [...dayData.program_exercises].sort(
            (a, b) => a.order_index - b.order_index
          ),
        };

        setDay(sortedDay);

        // Build initial exercise states
        const states: ExerciseState[] = sortedDay.program_exercises.map(
          (pe) => ({
            programExercise: pe,
            sets: Array.from({ length: pe.sets }, (_, i) => ({
              weightInput: String(pe.weight_kg),
              repsInput: String(
                pe.current_target_reps[i] ?? pe.reps_min
              ),
              completed: false,
              dbId: null,
            })),
          })
        );
        setExerciseStates(states);

        // 2. Get current user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        // 3. Create session row
        const { data: sessionData, error: sessionErr } = await supabase
          .from('sessions')
          .insert({
            user_id: user.id,
            program_day_id: dayId,
            done_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (sessionErr) throw sessionErr;
        if (cancelled) return;

        setSessionId(sessionData.id);
        startTimeRef.current = Date.now();
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Une erreur est survenue');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [dayId]);

  // ---------------------------------------------------------------------------
  // Rest timer logic
  // ---------------------------------------------------------------------------

  const startRestTimer = useCallback((seconds: number) => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    setRestTotal(seconds);
    setRestRemaining(seconds);

    restIntervalRef.current = setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(restIntervalRef.current!);
          restIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const skipRest = useCallback(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
    setRestRemaining(0);
    setRestTotal(0);
  }, []);

  useEffect(() => {
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Set input handlers (memoised per exercise index)
  // ---------------------------------------------------------------------------

  const handleWeightChange = useCallback(
    (exerciseIndex: number, setIndex: number, val: string) => {
      setExerciseStates((prev) => {
        const next = prev.map((es, ei) => {
          if (ei !== exerciseIndex) return es;
          const newSets = es.sets.map((s, si) =>
            si === setIndex ? { ...s, weightInput: val } : s
          );
          return { ...es, sets: newSets };
        });
        return next;
      });
    },
    []
  );

  const handleRepsChange = useCallback(
    (exerciseIndex: number, setIndex: number, val: string) => {
      setExerciseStates((prev) => {
        const next = prev.map((es, ei) => {
          if (ei !== exerciseIndex) return es;
          const newSets = es.sets.map((s, si) =>
            si === setIndex ? { ...s, repsInput: val } : s
          );
          return { ...es, sets: newSets };
        });
        return next;
      });
    },
    []
  );

  const handleConfirmSet = useCallback(
    async (exerciseIndex: number, setIndex: number) => {
      if (!sessionId || !day) return;

      const exState = exerciseStates[exerciseIndex];
      if (!exState) return;

      const draft = exState.sets[setIndex];
      if (!draft || draft.completed) return;

      const confirmKey = `${exerciseIndex}-${setIndex}`;
      if (pendingConfirms.current.has(confirmKey)) return;
      pendingConfirms.current.add(confirmKey);

      const repsDone = parseInt(draft.repsInput, 10);
      const weightDone = parseFloat(draft.weightInput);

      if (isNaN(repsDone) || isNaN(weightDone)) {
        Alert.alert('Valeurs invalides', 'Entrez des reps et un poids valides.');
        return;
      }

      // Insert session_set into DB
      const { data: insertedSet, error: insertErr } = await supabase
        .from('session_sets')
        .insert({
          session_id: sessionId,
          program_exercise_id: exState.programExercise.id,
          set_number: setIndex + 1,
          reps_done: repsDone,
          weight_done_kg: weightDone,
          completed: true,
        })
        .select()
        .single();

      if (insertErr) {
        Alert.alert('Erreur', insertErr.message);
        return;
      }

      // Mark set as completed locally
      setExerciseStates((prev) =>
        prev.map((es, ei) => {
          if (ei !== exerciseIndex) return es;
          const newSets = es.sets.map((s, si) =>
            si === setIndex
              ? { ...s, completed: true, dbId: insertedSet.id }
              : s
          );
          return { ...es, sets: newSets };
        })
      );

      // Start rest timer
      startRestTimer(day.rest_seconds);
    },
    [sessionId, day, exerciseStates, startRestTimer]
  );

  // ---------------------------------------------------------------------------
  // Finish session
  // ---------------------------------------------------------------------------

  const handleFinish = useCallback(async () => {
    if (!sessionId || !day) return;
    setConfirmingFinish(false);

    try {
      // 1. Fetch all session_sets for this session
      const { data: allSets, error: fetchErr } = await supabase
        .from('session_sets')
        .select('*')
        .eq('session_id', sessionId);

      if (fetchErr) throw fetchErr;

      // 2. Fetch previous session date for linear progression
      const { data: prevSessions } = await supabase
        .from('sessions')
        .select('done_at')
        .eq('program_day_id', dayId)
        .neq('id', sessionId)
        .order('done_at', { ascending: false })
        .limit(1);

      const lastSessionDate =
        prevSessions && prevSessions.length > 0
          ? new Date(prevSessions[0].done_at)
          : undefined;

      // 3. Build valid sets
      const validSets: ProgressionSessionSet[] = (allSets ?? [])
        .filter(
          (s): s is typeof s & { reps_done: number; weight_done_kg: number } =>
            s.reps_done != null && s.weight_done_kg != null
        )
        .map((s) => ({
          id: s.id,
          session_id: s.session_id,
          program_exercise_id: s.program_exercise_id,
          set_number: s.set_number,
          reps_done: s.reps_done,
          weight_done_kg: s.weight_done_kg,
          completed: s.completed,
        }));

      // 4. Save progression and navigate
      const applyAndNavigate = async (keepReps: boolean) => {
        const updateResults = await Promise.all(
          day.program_exercises.map((pe) => {
            const next = computeNextTargets(pe, validSets, lastSessionDate, keepReps);
            return supabase
              .from('program_exercises')
              .update({ weight_kg: next.weight_kg, current_target_reps: next.current_target_reps })
              .eq('id', pe.id);
          })
        );
        const progressionError = updateResults.find((r) => r.error)?.error;
        if (progressionError) {
          Alert.alert('Attention', `La progression n'a pas pu être sauvegardée : ${progressionError.message}`);
        }
        const durationSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        await supabase.from('sessions').update({ duration_seconds: durationSeconds }).eq('id', sessionId);
        router.replace('/(tabs)');
      };

      // 5. Check if any exercise would trigger a weight increase
      const wouldIncreaseMap = new Map<string, ProgressionUpdate>(
        day.program_exercises.map((pe) => [pe.id, computeNextTargets(pe, validSets, lastSessionDate, false)])
      );
      const exercisesIncreasing = day.program_exercises.filter(
        (pe) => (wouldIncreaseMap.get(pe.id)?.weight_kg ?? pe.weight_kg) > pe.weight_kg
      );

      if (exercisesIncreasing.length > 0) {
        const lines = exercisesIncreasing
          .map((pe) => {
            const next = wouldIncreaseMap.get(pe.id)!;
            return `${pe.exercise.name.toUpperCase()} : ${pe.weight_kg} → ${next.weight_kg} KG`;
          })
          .join('\n');

        Alert.alert(
          'OBJECTIF ATTEINT',
          `${lines}\n\nQue veux-tu faire ?`,
          [
            {
              text: 'CONTINUER LES REPS',
              onPress: () => applyAndNavigate(true).catch((e) =>
                Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur')
              ),
            },
            {
              text: 'AUGMENTER LE POIDS',
              onPress: () => applyAndNavigate(false).catch((e) =>
                Alert.alert('Erreur', e instanceof Error ? e.message : 'Erreur')
              ),
            },
          ],
          { cancelable: false }
        );
      } else {
        await applyAndNavigate(false);
      }
    } catch (e: unknown) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Une erreur est survenue');
    }
  }, [sessionId, day, router]);

  // ---------------------------------------------------------------------------
  // Stable per-exercise callbacks for the FlatList
  // ---------------------------------------------------------------------------

  const renderItem = useCallback(
    ({ item, index: exerciseIndex }: { item: ExerciseState; index: number }) => (
      <ExerciseCard
        exState={item}
        onSetWeightChange={(si, val) =>
          handleWeightChange(exerciseIndex, si, val)
        }
        onSetRepsChange={(si, val) =>
          handleRepsChange(exerciseIndex, si, val)
        }
        onConfirmSet={(si) => handleConfirmSet(exerciseIndex, si)}
      />
    ),
    [handleWeightChange, handleRepsChange, handleConfirmSet]
  );

  // ---------------------------------------------------------------------------
  // Layout measurements for bottom strip offset
  // ---------------------------------------------------------------------------

  const FINISH_BTN_HEIGHT = 64;
  const REST_STRIP_HEIGHT = 72;

  const listContentPaddingBottom = useMemo(
    () =>
      FINISH_BTN_HEIGHT +
      (restRemaining > 0 ? REST_STRIP_HEIGHT : 0) +
      insets.bottom +
      16,
    [insets.bottom, restRemaining]
  );

  const finishContainerHeight = useMemo(
    () => FINISH_BTN_HEIGHT + insets.bottom + 8,
    [insets.bottom]
  );

  const nextSetInfo = useMemo((): string => {
    if (!day) return '';
    for (const es of exerciseStates) {
      for (let si = 0; si < es.sets.length; si++) {
        if (!es.sets[si].completed) {
          const setNum = si + 1;
          const weight = es.sets[si].weightInput || String(es.programExercise.weight_kg);
          return `S${String(setNum).padStart(2, '0')} · ${weight} KG — ${es.programExercise.exercise.name.toUpperCase()}`;
        }
      }
    }
    return 'DERNIÈRE SÉRIE';
  }, [exerciseStates, day]);

  // ---------------------------------------------------------------------------
  // Render: loading / error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateText}>CHARGEMENT...</Text>
      </View>
    );
  }

  if (error || !day) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.stateText, { color: HAZARD }]}>
          {error ?? 'ERREUR INCONNUE'}
        </Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Quitter ?', 'La séance sera abandonnée.', [
                { text: 'Rester', style: 'cancel' },
                { text: 'Quitter', style: 'destructive', onPress: () => router.back() },
              ])
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backBtn}>←</Text>
          </TouchableOpacity>
          <Text style={styles.sessionName} numberOfLines={1}>
            {day.name.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.elapsedTime}>{formatTime(elapsed)}</Text>
      </View>

      {/* Separator */}
      <View style={styles.headerSeparator} />

      {/* ------------------------------------------------------------------ */}
      {/* Exercise list                                                        */}
      {/* ------------------------------------------------------------------ */}
      <FlatList
        data={exerciseStates}
        keyExtractor={(item) => item.programExercise.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: listContentPaddingBottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      {/* ------------------------------------------------------------------ */}
      {/* Rest timer strip — bottom, above finish button                       */}
      {/* ------------------------------------------------------------------ */}
      {restRemaining > 0 && (
        <RestTimerStrip
          remaining={restRemaining}
          total={restTotal}
          nextSetInfo={nextSetInfo}
          onSkip={skipRest}
          bottomOffset={finishContainerHeight}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Finish button                                                        */}
      {/* ------------------------------------------------------------------ */}
      <View
        style={[
          styles.finishContainer,
          { paddingBottom: insets.bottom + 8 },
        ]}
      >
        {confirmingFinish ? (
          <View style={styles.finishConfirmRow}>
            <TouchableOpacity
              style={styles.finishCancelBtn}
              onPress={() => setConfirmingFinish(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.finishCancelText}>ANNULER</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.finishConfirmBtn}
              onPress={handleFinish}
              activeOpacity={0.85}
            >
              <Text style={styles.finishConfirmText}>CONFIRMER ✓</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.finishBtn}
            onPress={() => setConfirmingFinish(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.finishBtnText}>TERMINER LA SÉANCE</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  // --- Loading / error ---
  centered: {
    flex: 1,
    backgroundColor: BACKGROUND,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stateText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 14,
    color: TEXT_PRIMARY,
    letterSpacing: 2,
  },

  // --- Header ---
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  backBtn: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 20,
    color: TEXT_PRIMARY,
    lineHeight: 24,
  },
  sessionName: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 16,
    color: TEXT_PRIMARY,
    letterSpacing: 2,
    flex: 1,
  },
  elapsedTime: {
    fontFamily: FONT_MONO,
    fontSize: 13,
    color: TEXT_SECONDARY,
    letterSpacing: 1,
    marginLeft: 8,
  },
  headerSeparator: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 0,
  },

  // --- List ---
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 16,
  },

  // --- Exercise card ---
  card: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  exerciseName: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 13,
    color: TEXT_PRIMARY,
    letterSpacing: 1.5,
    flex: 1,
  },
  muscleLabel: {
    fontFamily: FONT_MONO,
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 1,
    marginLeft: 8,
  },

  // --- Table header ---
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableHeaderCell: {
    fontFamily: FONT_MONO_MEDIUM,
    fontSize: 9,
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  colIndex: {
    width: 20,
  },
  colObjectif: {
    flex: 1,
  },
  colInput: {
    width: 52,
    textAlign: 'center',
  },
  colConfirm: {
    width: 32,
  },

  // --- Set row ---
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  setRowActive: {
    borderLeftColor: ACCENT,
  },
  setRowCompleted: {
    opacity: 0.6,
    borderLeftColor: 'transparent',
  },
  setIndexText: {
    fontFamily: FONT_MONO,
    fontSize: 12,
    color: TEXT_SECONDARY,
    width: 20,
  },
  setObjectifText: {
    fontFamily: FONT_MONO_MEDIUM,
    fontSize: 11,
    color: TEXT_SECONDARY,
    flex: 1,
    letterSpacing: 0.5,
  },
  setObjectifGhost: {
    opacity: 0.35,
  },
  setObjectifMet: {
    color: ACCENT,
    opacity: 1,
  },
  setObjectifMissed: {
    color: HAZARD,
    opacity: 1,
  },
  setInput: {
    width: 52,
    height: 32,
    backgroundColor: BACKGROUND,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 1,
    color: TEXT_PRIMARY,
    fontFamily: FONT_MONO,
    fontSize: 13,
    textAlign: 'center',
    marginHorizontal: 2,
    paddingHorizontal: 2,
    paddingVertical: 0,
  },
  setInputCompleted: {
    backgroundColor: SURFACE,
    borderColor: 'transparent',
  },

  // --- Confirm button ---
  confirmBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  confirmBtnDone: {
    // no special background when done
  },
  confirmBtnText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 16,
    color: ACCENT,
  },
  confirmBtnTextDone: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },

  // --- Rest timer strip (bottom) ---
  restStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    zIndex: 20,
  },
  restStripInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  restTimeBox: {
    backgroundColor: BACKGROUND,
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 72,
  },
  restTimeValue: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 28,
    color: ACCENT,
    letterSpacing: 2,
    lineHeight: 34,
  },
  restTimeLabel: {
    fontFamily: FONT_MONO,
    fontSize: 8,
    color: TEXT_SECONDARY,
    letterSpacing: 3,
    marginTop: 2,
  },
  restNextInfo: {
    flex: 1,
    fontFamily: FONT_MONO_MEDIUM,
    fontSize: 10,
    color: TEXT_PRIMARY,
    letterSpacing: 1,
  },
  restSkipBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  restSkipBtnText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 11,
    color: BACKGROUND,
    letterSpacing: 2,
  },
  restProgressTrack: {
    height: 3,
    backgroundColor: BORDER,
    width: '100%',
  },
  restProgressFill: {
    height: 3,
    backgroundColor: ACCENT,
  },

  // --- Finish button ---
  finishContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: BACKGROUND,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  finishBtn: {
    backgroundColor: HAZARD,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  finishBtnText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 14,
    color: TEXT_PRIMARY,
    letterSpacing: 3,
  },
  finishConfirmRow: {
    flexDirection: 'row',
    gap: 8,
    height: 56,
  },
  finishCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  finishCancelText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 12,
    color: TEXT_SECONDARY,
    letterSpacing: 2,
  },
  finishConfirmBtn: {
    flex: 2,
    backgroundColor: HAZARD,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  finishConfirmText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 14,
    color: TEXT_PRIMARY,
    letterSpacing: 2,
  },
});
