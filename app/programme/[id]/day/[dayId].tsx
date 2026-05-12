import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { useExerciseLibrary } from '../../../../hooks/useExerciseLibrary';
import { BACKGROUND, ACCENT, HAZARD, TEXT_PRIMARY, TEXT_SECONDARY, BORDER, SURFACE } from '../../../../constants/colors';
import { FONT_MONO_BOLD, FONT_MONO } from '../../../../constants/fonts';
import type { ProgramExerciseRow, Exercise } from '../../../../types/database';

const PROG_MAP: Record<string, string> = {
  double: 'DOUBLE',
  linear: 'LINÉAIRE',
  rep_per_session: 'REP/SÉANCE',
};

export default function DayDetailScreen() {
  const router = useRouter();
  const { id, dayId } = useLocalSearchParams<{ id: string; dayId: string }>();
  const { exercises: library } = useExerciseLibrary();

  const [dayName, setDayName] = useState('');
  const [restSeconds, setRestSeconds] = useState(90);
  const [exercises, setExercises] = useState<ProgramExerciseRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Exercise picker modal
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // Config after selecting exercise
  const [sets, setSets] = useState('3');
  const [repsMin, setRepsMin] = useState('8');
  const [repsMax, setRepsMax] = useState('12');
  const [weight, setWeight] = useState('0');
  const [programProgType, setProgramProgType] = useState<'double' | 'linear' | 'rep_per_session'>('double');
  const [progValue, setProgValue] = useState('2.5');
  const [savingExercise, setSavingExercise] = useState(false);

  // Edit existing exercise
  const [editingExercise, setEditingExercise] = useState<ProgramExerciseRow | null>(null);
  const [editSets, setEditSets] = useState('3');
  const [editRepsMin, setEditRepsMin] = useState('8');
  const [editRepsMax, setEditRepsMax] = useState('12');
  const [editWeight, setEditWeight] = useState('0');
  const [editProgType, setEditProgType] = useState<'double' | 'linear' | 'rep_per_session'>('double');
  const [editProgValue, setEditProgValue] = useState('2.5');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('program_days')
      .select('name, rest_seconds, programs(progression_type), program_exercises(*, exercise:exercises(*))')
      .eq('id', dayId)
      .single();
    if (data) {
      setDayName(data.name);
      setRestSeconds(data.rest_seconds);
      setProgramProgType((data as any).programs?.progression_type ?? 'double');
      setExercises(
        (data.program_exercises as ProgramExerciseRow[]).sort((a, b) => a.order_index - b.order_index)
      );
    }
    setLoading(false);
  }, [dayId]);

  useEffect(() => { load(); }, [load]);

  async function saveExercise() {
    if (!selectedExercise) return;
    setSavingExercise(true);
    const setsNum = parseInt(sets) || 3;
    const repsMinNum = parseInt(repsMin) || 8;
    const repsMaxNum = parseInt(repsMax) || 12;
    const weightNum = parseFloat(weight) || 0;
    const progValueNum = parseFloat(progValue) || 2.5;

    const { error } = await supabase.from('program_exercises').insert({
      program_day_id: dayId,
      exercise_id: selectedExercise.id,
      sets: setsNum,
      reps_min: repsMinNum,
      reps_max: repsMaxNum,
      weight_kg: weightNum,
      progression_type: programProgType,
      progression_value: progValueNum,
      current_target_reps: Array(setsNum).fill(repsMinNum),
      order_index: exercises.length,
    });

    if (!error) {
      setPickerVisible(false);
      setSelectedExercise(null);
      setSearch('');
      setSelectedMuscle(null);
      load();
    }
    setSavingExercise(false);
  }

  function openEdit(ex: ProgramExerciseRow) {
    setEditingExercise(ex);
    setEditSets(String(ex.sets));
    setEditRepsMin(String(ex.reps_min));
    setEditRepsMax(String(ex.reps_max));
    setEditWeight(String(ex.weight_kg));
    setEditProgType(ex.progression_type);
    setEditProgValue(String(ex.progression_value));
  }

  async function saveEdit() {
    if (!editingExercise) return;
    setSavingEdit(true);
    const setsNum = parseInt(editSets) || 3;
    const repsMinNum = parseInt(editRepsMin) || 8;
    const repsMaxNum = parseInt(editRepsMax) || 12;
    const weightNum = parseFloat(editWeight) || 0;
    const progValueNum = parseFloat(editProgValue) || 2.5;

    const update: Record<string, unknown> = {
      sets: setsNum,
      reps_min: repsMinNum,
      reps_max: repsMaxNum,
      weight_kg: weightNum,
      progression_type: editProgType,
      progression_value: progValueNum,
    };
    if (setsNum !== editingExercise.sets) {
      update.current_target_reps = Array(setsNum).fill(repsMinNum);
    }

    const { error } = await supabase
      .from('program_exercises')
      .update(update)
      .eq('id', editingExercise.id);

    if (!error) {
      setEditingExercise(null);
      load();
    }
    setSavingEdit(false);
  }

  async function deleteExercise(exId: string) {
    Alert.alert('SUPPRIMER', 'Retirer cet exercice ?', [
      { text: 'ANNULER', style: 'cancel' },
      {
        text: 'SUPPRIMER', style: 'destructive',
        onPress: async () => {
          await supabase.from('program_exercises').delete().eq('id', exId);
          load();
        },
      },
    ]);
  }

  const muscleGroups = useMemo(
    () => [...new Set(library.map((e) => e.muscle_group).filter(Boolean))].sort() as string[],
    [library]
  );

  const filtered = useMemo(
    () => library.filter((e) => {
      const matchSearch =
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        (e.muscle_group ?? '').toLowerCase().includes(search.toLowerCase());
      const matchMuscle = !selectedMuscle || e.muscle_group === selectedMuscle;
      return matchSearch && matchMuscle;
    }),
    [library, search, selectedMuscle]
  );

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={ACCENT} /></View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← RETOUR</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{dayName}</Text>
        <Text style={styles.subtitle}>REPOS : {restSeconds}S · {exercises.length} EXERCICE{exercises.length !== 1 ? 'S' : ''}</Text>
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <TouchableOpacity style={styles.addBtn} onPress={() => setPickerVisible(true)}>
            <Text style={styles.addBtnText}>+ AJOUTER UN EXERCICE</Text>
          </TouchableOpacity>
        }
        renderItem={({ item, index }) => (
          <TouchableOpacity style={styles.exCard} onPress={() => openEdit(item)} activeOpacity={0.75}>
            <View style={styles.exCardLeft}>
              <Text style={styles.exIndex}>{index + 1}</Text>
            </View>
            <View style={styles.exCardBody}>
              <Text style={styles.exName}>{item.exercise.name.toUpperCase()}</Text>
              <Text style={styles.exMeta}>{item.exercise.muscle_group?.toUpperCase()}</Text>
              <Text style={styles.exMeta}>
                {item.sets}×{item.reps_min}-{item.reps_max} · {item.weight_kg}KG · {PROG_MAP[item.progression_type]}
              </Text>
            </View>
            <TouchableOpacity onPress={() => deleteExercise(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.deleteBtn}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      {/* Edit exercise modal */}
      <Modal
        visible={!!editingExercise}
        animationType="slide"
        onRequestClose={() => setEditingExercise(null)}
      >
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingExercise(null)}>
              <Text style={styles.back}>✕ FERMER</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>MODIFIER</Text>
          </View>
          <ScrollView contentContainerStyle={styles.configForm} keyboardShouldPersistTaps="handled">
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedName}>{editingExercise?.exercise.name.toUpperCase()}</Text>
              <Text style={[styles.libMeta, { color: TEXT_SECONDARY }]}>{editingExercise?.exercise.muscle_group?.toUpperCase()}</Text>
            </View>

            <View style={styles.configRow}>
              {[
                { label: 'SÉRIES', value: editSets, setter: setEditSets },
                { label: 'REPS MIN', value: editRepsMin, setter: setEditRepsMin },
                { label: 'REPS MAX', value: editRepsMax, setter: setEditRepsMax },
              ].map((f) => (
                <View key={f.label} style={styles.configField}>
                  <Text style={styles.label}>{f.label}</Text>
                  <TextInput
                    style={styles.configInput}
                    value={f.value}
                    onChangeText={f.setter}
                    keyboardType="numeric"
                  />
                </View>
              ))}
            </View>

            <View style={styles.configRow}>
              {[
                { label: 'POIDS (KG)', value: editWeight, setter: setEditWeight },
                { label: 'INCRÉMENT', value: editProgValue, setter: setEditProgValue },
              ].map((f) => (
                <View key={f.label} style={[styles.configField, { flex: 1 }]}>
                  <Text style={styles.label}>{f.label}</Text>
                  <TextInput
                    style={styles.configInput}
                    value={f.value}
                    onChangeText={f.setter}
                    keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>PROGRESSION</Text>
              <View style={styles.optionRow}>
                {(['double', 'linear', 'rep_per_session'] as const).map((pt) => (
                  <TouchableOpacity
                    key={pt}
                    style={[styles.option, editProgType === pt && styles.optionActive]}
                    onPress={() => setEditProgType(pt)}
                  >
                    <Text style={[styles.optionText, editProgType === pt && styles.optionTextActive]}>
                      {PROG_MAP[pt]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, savingEdit && { opacity: 0.5 }]}
              onPress={saveEdit}
              disabled={savingEdit}
            >
              {savingEdit
                ? <ActivityIndicator color={BACKGROUND} />
                : <Text style={styles.saveBtnText}>ENREGISTRER →</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Exercise picker modal */}
      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => { setPickerVisible(false); setSelectedExercise(null); setSearch(''); setSelectedMuscle(null); }}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { setPickerVisible(false); setSelectedExercise(null); setSearch(''); setSelectedMuscle(null); }}>
              <Text style={styles.back}>✕ FERMER</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {selectedExercise ? 'CONFIGURER' : 'CHOISIR UN EXERCICE'}
            </Text>
          </View>

          {!selectedExercise ? (
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="RECHERCHER..."
                placeholderTextColor={TEXT_SECONDARY}
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={styles.filterRowContent}
              >
                <TouchableOpacity
                  style={[styles.filterChip, !selectedMuscle && styles.filterChipActive]}
                  onPress={() => setSelectedMuscle(null)}
                >
                  <Text style={[styles.filterChipText, !selectedMuscle && styles.filterChipTextActive]}>TOUS</Text>
                </TouchableOpacity>
                {muscleGroups.map((muscle) => (
                  <TouchableOpacity
                    key={muscle}
                    style={[styles.filterChip, selectedMuscle === muscle && styles.filterChipActive]}
                    onPress={() => setSelectedMuscle(selectedMuscle === muscle ? null : muscle)}
                  >
                    <Text style={[styles.filterChipText, selectedMuscle === muscle && styles.filterChipTextActive]}>
                      {muscle.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {filtered.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.libItem} onPress={() => setSelectedExercise(item)} activeOpacity={0.7}>
                    <Text style={styles.libName}>{item.name.toUpperCase()}</Text>
                    <Text style={styles.libMeta}>{item.muscle_group?.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.configForm} keyboardShouldPersistTaps="handled">
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedName}>{selectedExercise.name.toUpperCase()}</Text>
                <TouchableOpacity onPress={() => setSelectedExercise(null)}>
                  <Text style={styles.changeBtn}>CHANGER</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.configRow}>
                {[
                  { label: 'SÉRIES', value: sets, setter: setSets },
                  { label: 'REPS MIN', value: repsMin, setter: setRepsMin },
                  { label: 'REPS MAX', value: repsMax, setter: setRepsMax },
                ].map((f) => (
                  <View key={f.label} style={styles.configField}>
                    <Text style={styles.label}>{f.label}</Text>
                    <TextInput
                      style={styles.configInput}
                      value={f.value}
                      onChangeText={f.setter}
                      keyboardType="numeric"
                    />
                  </View>
                ))}
              </View>

              <View style={styles.configRow}>
                {[
                  { label: 'POIDS (KG)', value: weight, setter: setWeight },
                  { label: 'INCRÉMENT', value: progValue, setter: setProgValue },
                ].map((f) => (
                  <View key={f.label} style={[styles.configField, { flex: 1 }]}>
                    <Text style={styles.label}>{f.label}</Text>
                    <TextInput
                      style={styles.configInput}
                      value={f.value}
                      onChangeText={f.setter}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, savingExercise && { opacity: 0.5 }]}
                onPress={saveExercise}
                disabled={savingExercise}
              >
                {savingExercise
                  ? <ActivityIndicator color={BACKGROUND} />
                  : <Text style={styles.saveBtnText}>AJOUTER À LA SÉANCE →</Text>
                }
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  center: { flex: 1, backgroundColor: BACKGROUND, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 24, gap: 8 },
  back: { fontFamily: FONT_MONO, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 2 },
  title: { fontFamily: FONT_MONO_BOLD, fontSize: 24, color: TEXT_PRIMARY, letterSpacing: 2 },
  subtitle: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 1.5 },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  exCard: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    flexDirection: 'row', alignItems: 'center',
  },
  exCardLeft: {
    width: 40, alignItems: 'center', justifyContent: 'center',
    borderRightWidth: 1, borderRightColor: BORDER, paddingVertical: 16,
  },
  exIndex: { fontFamily: FONT_MONO_BOLD, fontSize: 12, color: TEXT_SECONDARY },
  exCardBody: { flex: 1, padding: 12, gap: 3 },
  exName: { fontFamily: FONT_MONO_BOLD, fontSize: 12, color: TEXT_PRIMARY, letterSpacing: 1 },
  exMeta: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 1 },
  deleteBtn: { fontFamily: FONT_MONO_BOLD, fontSize: 12, color: HAZARD, paddingHorizontal: 16 },
  addBtn: {
    borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed',
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  addBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 2 },
  modal: { flex: 1, backgroundColor: BACKGROUND },
  modalHeader: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, gap: 12 },
  modalTitle: { fontFamily: FONT_MONO_BOLD, fontSize: 22, color: TEXT_PRIMARY, letterSpacing: 2 },
  searchInput: {
    marginHorizontal: 16, marginBottom: 8, backgroundColor: SURFACE,
    borderWidth: 1, borderColor: BORDER, color: TEXT_PRIMARY,
    fontFamily: FONT_MONO, fontSize: 13, paddingHorizontal: 12, paddingVertical: 12,
  },
  filterRow: { height: 52, marginBottom: 8 },
  filterRowContent: { paddingHorizontal: 16, gap: 6, alignItems: 'center', paddingVertical: 8 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: BORDER,
  },
  filterChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  filterChipText: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 1.5 },
  filterChipTextActive: { color: BACKGROUND },
  libItem: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  libName: { fontFamily: FONT_MONO_BOLD, fontSize: 13, color: TEXT_PRIMARY, letterSpacing: 1 },
  libMeta: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 1.5, marginTop: 2 },
  selectedBadge: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: ACCENT,
    padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  selectedName: { fontFamily: FONT_MONO_BOLD, fontSize: 13, color: TEXT_PRIMARY },
  changeBtn: { fontFamily: FONT_MONO, fontSize: 10, color: ACCENT, letterSpacing: 1.5 },
  configForm: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  configRow: { flexDirection: 'row', gap: 8 },
  configField: { flex: 1, gap: 6 },
  label: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 2 },
  configInput: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontFamily: FONT_MONO_BOLD, fontSize: 18,
    paddingHorizontal: 12, paddingVertical: 10, textAlign: 'center',
  },
  field: { gap: 8 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderColor: BORDER, paddingHorizontal: 12, paddingVertical: 10 },
  optionActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  optionText: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 1 },
  optionTextActive: { color: BACKGROUND },
  saveBtn: { backgroundColor: ACCENT, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 13, color: BACKGROUND, letterSpacing: 2 },
});
