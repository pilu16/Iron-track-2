export interface Exercise {
  id: string;
  name: string;
  muscle_group: string | null;
  equipment_needed: string | null;
}

export interface ProgramExerciseRow {
  id: string;
  program_day_id: string;
  exercise_id: string;
  sets: number;
  reps_min: number;
  reps_max: number;
  weight_kg: number;
  progression_type: 'double' | 'linear' | 'rep_per_session';
  progression_value: number;
  current_target_reps: number[];
  order_index: number;
  rir_target: number | null;
  tempo: string | null;
  notes: string | null;
  video_url: string | null;
  indications: string | null;
  machine_settings: string | null;
  exercise: Exercise;
}

export interface ProgramDay {
  id: string;
  program_id: string;
  day_order: number;
  name: string;
  rest_seconds: number;
  weekdays: string | null;
  program_exercises: ProgramExerciseRow[];
}

export interface Program {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  deload_active: boolean;
  deload_until: string | null;
  created_at: string;
  program_days: ProgramDay[];
}

export interface SessionRow {
  id: string;
  user_id: string;
  program_day_id: string;
  done_at: string;
  duration_seconds: number | null;
}

export interface SessionSetRow {
  id: string;
  session_id: string;
  program_exercise_id: string;
  set_number: number;
  reps_done: number | null;
  weight_done_kg: number | null;
  completed: boolean;
}

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
