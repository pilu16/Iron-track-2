import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { BACKGROUND, ACCENT, HAZARD, TEXT_PRIMARY, TEXT_SECONDARY, BORDER, SURFACE } from '../../../constants/colors';
import { FONT_MONO_BOLD, FONT_MONO } from '../../../constants/fonts';
import type { ProgramDay } from '../../../types/database';

const DAYS_FR = [
  { key: 'lundi', label: 'L' }, { key: 'mardi', label: 'M' },
  { key: 'mercredi', label: 'M' }, { key: 'jeudi', label: 'J' },
  { key: 'vendredi', label: 'V' }, { key: 'samedi', label: 'S' },
  { key: 'dimanche', label: 'D' },
];

export default function ProgramDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [programName, setProgramName] = useState('');
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingDay, setAddingDay] = useState(false);
  const [newDayName, setNewDayName] = useState('');
  const [newDayWeekdays, setNewDayWeekdays] = useState<string[]>([]);
  const [savingDay, setSavingDay] = useState(false);

  const loadProgram = useCallback(async () => {
    const { data } = await supabase
      .from('programs')
      .select('name, program_days(*, program_exercises(id))')
      .eq('id', id)
      .single();
    if (data) {
      setProgramName(data.name);
      setDays((data.program_days as ProgramDay[]).sort((a, b) => a.day_order - b.day_order));
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { loadProgram(); }, [loadProgram]);

  function toggleWeekday(key: string) {
    setNewDayWeekdays((prev) =>
      prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]
    );
  }

  async function saveDay() {
    if (!newDayName.trim()) return;
    setSavingDay(true);
    const { error } = await supabase.from('program_days').insert({
      program_id: id,
      day_order: days.length + 1,
      name: newDayName.trim().toUpperCase(),
      weekdays: newDayWeekdays.join(','),
      rest_seconds: 90,
    });
    if (!error) {
      setAddingDay(false);
      setNewDayName('');
      setNewDayWeekdays([]);
      loadProgram();
    }
    setSavingDay(false);
  }

  async function deleteDay(dayId: string) {
    Alert.alert('SUPPRIMER', 'Supprimer cette séance ?', [
      { text: 'ANNULER', style: 'cancel' },
      {
        text: 'SUPPRIMER', style: 'destructive',
        onPress: async () => {
          await supabase.from('program_days').delete().eq('id', dayId);
          loadProgram();
        },
      },
    ]);
  }

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={ACCENT} /></View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← RETOUR</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{programName.toUpperCase()}</Text>
        <Text style={styles.subtitle}>{days.length} SÉANCE{days.length !== 1 ? 'S' : ''}</Text>
      </View>

      <FlatList
        data={days}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListFooterComponent={
          <View style={{ gap: 12 }}>
            {addingDay ? (
              <View style={styles.addDayForm}>
                <Text style={styles.label}>NOM DE LA SÉANCE</Text>
                <TextInput
                  style={styles.input}
                  value={newDayName}
                  onChangeText={setNewDayName}
                  placeholder="ex: SÉANCE A — PUSH"
                  placeholderTextColor={TEXT_SECONDARY}
                  autoCapitalize="characters"
                  autoFocus
                />
                <Text style={[styles.label, { marginTop: 12 }]}>JOURS</Text>
                <View style={styles.weekRow}>
                  {DAYS_FR.map((d) => (
                    <TouchableOpacity
                      key={d.key}
                      style={[styles.dayBtn, newDayWeekdays.includes(d.key) && styles.dayBtnActive]}
                      onPress={() => toggleWeekday(d.key)}
                    >
                      <Text style={[styles.dayBtnText, newDayWeekdays.includes(d.key) && styles.dayBtnTextActive]}>
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.formActions}>
                  <TouchableOpacity style={styles.btnSecondary} onPress={() => setAddingDay(false)}>
                    <Text style={styles.btnSecondaryText}>ANNULER</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnPrimary, savingDay && { opacity: 0.5 }]}
                    onPress={saveDay}
                    disabled={savingDay}
                  >
                    {savingDay
                      ? <ActivityIndicator color={BACKGROUND} size="small" />
                      : <Text style={styles.btnPrimaryText}>ENREGISTRER →</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => setAddingDay(true)}>
                <Text style={styles.addBtnText}>+ AJOUTER UNE SÉANCE</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.dayCard}
            onPress={() => router.push(`/programme/${id}/day/${item.id}`)}
            activeOpacity={0.75}
          >
            <View style={styles.dayCardLeft}>
              <Text style={styles.dayName}>{item.name}</Text>
              {item.weekdays ? (
                <Text style={styles.dayMeta}>{item.weekdays.toUpperCase()}</Text>
              ) : null}
              <Text style={styles.dayMeta}>
                {(item.program_exercises as any[]).length} EXERCICE{(item.program_exercises as any[]).length !== 1 ? 'S' : ''}
              </Text>
            </View>
            <View style={styles.dayCardRight}>
              <Text style={styles.chevron}>→</Text>
              <TouchableOpacity onPress={() => deleteDay(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.deleteBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  center: { flex: 1, backgroundColor: BACKGROUND, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 24, gap: 8 },
  back: { fontFamily: FONT_MONO, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 2 },
  title: { fontFamily: FONT_MONO_BOLD, fontSize: 28, color: TEXT_PRIMARY, letterSpacing: 2 },
  subtitle: { fontFamily: FONT_MONO, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 2 },
  list: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  dayCard: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  dayCardLeft: { gap: 4, flex: 1 },
  dayName: { fontFamily: FONT_MONO_BOLD, fontSize: 14, color: TEXT_PRIMARY, letterSpacing: 1 },
  dayMeta: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 1.5 },
  dayCardRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chevron: { fontFamily: FONT_MONO_BOLD, fontSize: 16, color: ACCENT },
  deleteBtn: { fontFamily: FONT_MONO_BOLD, fontSize: 12, color: HAZARD },
  addBtn: {
    borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed',
    paddingVertical: 16, alignItems: 'center', marginTop: 8,
  },
  addBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 2 },
  addDayForm: { backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER, padding: 16, gap: 8 },
  label: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 2 },
  input: {
    backgroundColor: BACKGROUND, borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontFamily: FONT_MONO, fontSize: 14,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  weekRow: { flexDirection: 'row', gap: 6 },
  dayBtn: { width: 36, height: 36, borderWidth: 1, borderColor: BORDER, justifyContent: 'center', alignItems: 'center' },
  dayBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  dayBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: TEXT_SECONDARY },
  dayBtnTextActive: { color: BACKGROUND },
  formActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  btnPrimary: { flex: 1, backgroundColor: ACCENT, paddingVertical: 14, alignItems: 'center' },
  btnPrimaryText: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: BACKGROUND, letterSpacing: 1.5 },
  btnSecondary: { flex: 1, borderWidth: 1, borderColor: BORDER, paddingVertical: 14, alignItems: 'center' },
  btnSecondaryText: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: TEXT_PRIMARY, letterSpacing: 1.5 },
});
