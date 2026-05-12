export type ProgressionType = 'double' | 'linear' | 'rep_per_session';

export interface ProgramExercise {
  id: string;
  program_day_id: string;
  exercise_id: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight_kg: number;
  progression_type: ProgressionType;
  progression_value: number;
  current_target_reps: number[];
  order_index: number;
  rir_target: number | null;
  tempo: string | null;
  notes: string | null;
  video_url: string | null;
  indications: string | null;
  machine_settings: string | null;
}

export interface SessionSet {
  id: string;
  session_id: string;
  program_exercise_id: string;
  set_number: number;
  reps_done: number;
  weight_done_kg: number;
  completed: boolean;
}

export interface ProgressionUpdate {
  weight_kg: number;
  current_target_reps: number[];
}

/** Round to nearest 0.5 kg — ex: 61.3 → 61.5 */
export function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Règle 1 — Double progression
 * Si TOUTES les séries complétées atteignent reps_max → poids + progression_value, retour à reps_min.
 * Sinon → aucun changement.
 * keepReps = true : ne pas augmenter le poids, garder l'état actuel.
 */
function doubleProgression(
  exercise: ProgramExercise,
  sets: SessionSet[],
  keepReps = false,
): ProgressionUpdate {
  const completed = sets.filter((s) => s.completed);
  const allHitMax =
    completed.length >= exercise.sets &&
    completed.every((s) => s.reps_done >= exercise.reps_max);

  if (allHitMax) {
    if (keepReps) {
      return {
        weight_kg: exercise.weight_kg,
        current_target_reps: exercise.current_target_reps,
      };
    }
    return {
      weight_kg: roundToHalf(exercise.weight_kg + exercise.progression_value),
      current_target_reps: Array(exercise.sets).fill(exercise.reps_min),
    };
  }

  return {
    weight_kg: exercise.weight_kg,
    current_target_reps: exercise.current_target_reps,
  };
}

/**
 * Règle 2 — Progression linéaire
 * Ajoute progression_value kg si la dernière séance date de 7 jours ou plus.
 * Peu importe les reps effectuées.
 */
function linearProgression(
  exercise: ProgramExercise,
  lastSessionDate: Date | undefined
): ProgressionUpdate {
  if (!lastSessionDate) {
    return {
      weight_kg: exercise.weight_kg,
      current_target_reps: exercise.current_target_reps,
    };
  }

  const daysSince =
    (Date.now() - lastSessionDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince >= 7) {
    return {
      weight_kg: roundToHalf(exercise.weight_kg + exercise.progression_value),
      current_target_reps: exercise.current_target_reps,
    };
  }

  return {
    weight_kg: exercise.weight_kg,
    current_target_reps: exercise.current_target_reps,
  };
}

/**
 * Règle 3 — Progression par rep (rep_per_session)
 * Progression par nivellement : 8/8/8→8/8/9→8/9/9→9/9/9→...→12/12/12
 * Quand toutes les séries atteignent reps_max → poids + progression_value, retour à reps_min.
 * keepReps = true : continuer à monter les reps au-delà de reps_max sans augmenter le poids.
 */
function repPerSession(
  exercise: ProgramExercise,
  sets: SessionSet[],
  keepReps = false,
): ProgressionUpdate {
  const targets = [...exercise.current_target_reps];

  // Trier les séries par numéro pour comparer dans l'ordre
  const completed = sets
    .filter((s) => s.completed)
    .sort((a, b) => a.set_number - b.set_number);

  // Pas assez de séries complétées → pas de progression
  if (completed.length < exercise.sets) {
    return { weight_kg: exercise.weight_kg, current_target_reps: targets };
  }

  // Vérifier que chaque série atteint sa cible
  const allAchieved = completed.every(
    (s, i) => s.reps_done >= (targets[i] ?? exercise.reps_min)
  );

  if (!allAchieved) {
    return { weight_kg: exercise.weight_kg, current_target_reps: targets };
  }

  // Toutes les séries sont déjà à reps_max
  if (targets.every((r) => r >= exercise.reps_max)) {
    if (keepReps) {
      // Continuer à monter les reps au-delà de reps_max (même algo de nivellement)
      const newTargets = [...targets];
      const maxRep = Math.max(...newTargets);
      const allEqual = newTargets.every((r) => r === maxRep);
      if (allEqual) {
        newTargets[newTargets.length - 1] += 1;
      } else {
        for (let i = newTargets.length - 1; i >= 0; i--) {
          if (newTargets[i] < maxRep) { newTargets[i] += 1; break; }
        }
      }
      return { weight_kg: exercise.weight_kg, current_target_reps: newTargets };
    }
    return {
      weight_kg: roundToHalf(exercise.weight_kg + exercise.progression_value),
      current_target_reps: Array(exercise.sets).fill(exercise.reps_min),
    };
  }

  // Progression par nivellement : toutes les séries avancent ensemble.
  // Si toutes sont égales → le dernier set prend 1 rep d'avance.
  // Sinon → le premier set depuis la fin qui est en retard sur le maximum rattrape +1.
  // Résultat : 8/8/8 → 8/8/9 → 8/9/9 → 9/9/9 → 9/9/10 → 9/10/10 → 10/10/10
  const newTargets = [...targets];
  const maxRep = Math.max(...newTargets);
  const allEqual = newTargets.every((r) => r === maxRep);

  if (allEqual) {
    newTargets[newTargets.length - 1] += 1;
  } else {
    for (let i = newTargets.length - 1; i >= 0; i--) {
      if (newTargets[i] < maxRep) {
        newTargets[i] += 1;
        break;
      }
    }
  }

  return { weight_kg: exercise.weight_kg, current_target_reps: newTargets };
}

/**
 * Fonction principale — calcule les nouveaux objectifs à sauvegarder dans program_exercises.
 *
 * @param programExercise  L'exercice tel qu'il est actuellement en base
 * @param sessionSets      Toutes les séries de la séance (filtrées sur cet exercice en interne)
 * @param lastSessionDate  Date de la dernière séance sur cet exercice (requis pour 'linear')
 * @returns                Les valeurs à écrire dans program_exercises (weight_kg + current_target_reps)
 */
export function computeNextTargets(
  programExercise: ProgramExercise,
  sessionSets: SessionSet[],
  lastSessionDate?: Date,
  keepReps = false,
): ProgressionUpdate {
  const sets = sessionSets.filter(
    (s) => s.program_exercise_id === programExercise.id
  );

  switch (programExercise.progression_type) {
    case 'double':
      return doubleProgression(programExercise, sets, keepReps);
    case 'linear':
      return linearProgression(programExercise, lastSessionDate);
    case 'rep_per_session':
      return repPerSession(programExercise, sets, keepReps);
    default:
      return { weight_kg: programExercise.weight_kg, current_target_reps: programExercise.current_target_reps };
  }
}
