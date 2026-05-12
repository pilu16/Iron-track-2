import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useActiveProgram } from '../../hooks/useActiveProgram';
import { supabase } from '../../lib/supabase';
import { BACKGROUND, ACCENT, HAZARD, TEXT_PRIMARY, TEXT_SECONDARY, BORDER, SURFACE } from '../../constants/colors';
import { FONT_MONO_BOLD, FONT_MONO } from '../../constants/fonts';

export default function ProgrammeScreen() {
  const router = useRouter();
  const { program, loading, refetch } = useActiveProgram();

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  function deleteProgram() {
    if (!program) return;
    Alert.alert(
      'SUPPRIMER LE PROGRAMME',
      `"${program.name}" sera supprimé définitivement. Les séances du journal ne seront plus affichées.`,
      [
        { text: 'ANNULER', style: 'cancel' },
        {
          text: 'SUPPRIMER',
          style: 'destructive',
          onPress: async () => {
            const dayIds = program.program_days.map((d) => d.id);
            if (dayIds.length > 0) {
              await supabase.from('program_exercises').delete().in('program_day_id', dayIds);
              await supabase.from('program_days').delete().in('id', dayIds);
            }
            await supabase.from('programs').delete().eq('id', program.id);
            refetch();
          },
        },
      ]
    );
  }

  if (loading) return (
    <View style={styles.center}><ActivityIndicator color={ACCENT} /></View>
  );

  if (!program) return (
    <View style={styles.container}>
      <Text style={styles.title}>PROGRAMME.</Text>
      <Text style={styles.empty}>AUCUN PROGRAMME ACTIF.</Text>
      <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/programme/create')}>
        <Text style={styles.createBtnText}>+ CRÉER UN PROGRAMME</Text>
      </TouchableOpacity>
    </View>
  );

  const days = [...program.program_days].sort((a, b) => a.day_order - b.day_order);
  const totalExercises = days.reduce((acc, d) => acc + d.program_exercises.length, 0);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.inner}>
      <Text style={styles.title}>PROGRAMME.</Text>

      <TouchableOpacity
        style={styles.programCard}
        onPress={() => router.push(`/programme/${program.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.programCardTop}>
          <View style={styles.programCardMain}>
            <Text style={styles.programName}>{program.name}</Text>
            <Text style={styles.programMeta}>
              {days.length} SÉANCE{days.length !== 1 ? 'S' : ''} · {totalExercises} EXERCICES
            </Text>
            {program.deload_active && (
              <View style={styles.deloadBadge}>
                <Text style={styles.deloadText}>⚠ DÉCHARGE EN COURS</Text>
              </View>
            )}
          </View>
          <Text style={styles.chevron}>→</Text>
        </View>
        <View style={styles.daysPreview}>
          {days.map((d) => (
            <View key={d.id} style={styles.dayChip}>
              <Text style={styles.dayChipText}>{d.name.toUpperCase()}</Text>
              {d.weekdays ? (
                <Text style={styles.dayChipMeta}>{d.weekdays.toUpperCase()}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.newProgramBtn}
        onPress={() => router.push('/programme/create')}
      >
        <Text style={styles.newProgramBtnText}>+ NOUVEAU PROGRAMME</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={deleteProgram}
        activeOpacity={0.8}
      >
        <Text style={styles.deleteBtnText}>SUPPRIMER CE PROGRAMME</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: BACKGROUND },
  inner: { paddingTop: 64, paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  center: { flex: 1, backgroundColor: BACKGROUND, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: BACKGROUND, paddingTop: 64, paddingHorizontal: 16 },
  title: { fontFamily: FONT_MONO_BOLD, fontSize: 36, color: TEXT_PRIMARY, letterSpacing: 3, marginBottom: 4 },
  empty: { fontFamily: FONT_MONO, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 2, marginTop: 24 },
  createBtn: { backgroundColor: ACCENT, marginTop: 24, paddingVertical: 16, alignItems: 'center' },
  createBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 13, color: BACKGROUND, letterSpacing: 2 },

  programCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: ACCENT,
    padding: 16,
    gap: 12,
  },
  programCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  programCardMain: { flex: 1, gap: 4 },
  programName: { fontFamily: FONT_MONO_BOLD, fontSize: 20, color: TEXT_PRIMARY, letterSpacing: 2 },
  programMeta: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 1.5 },
  deloadBadge: { backgroundColor: '#FF4A1F22', borderLeftWidth: 3, borderLeftColor: '#FF4A1F', padding: 8, marginTop: 4 },
  deloadText: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: '#FF4A1F', letterSpacing: 2 },
  chevron: { fontFamily: FONT_MONO_BOLD, fontSize: 18, color: ACCENT, marginLeft: 8 },

  daysPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayChip: {
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 2,
  },
  dayChipText: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_PRIMARY, letterSpacing: 1 },
  dayChipMeta: { fontFamily: FONT_MONO, fontSize: 8, color: TEXT_SECONDARY, letterSpacing: 1 },

  newProgramBtn: {
    borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed',
    paddingVertical: 14, alignItems: 'center',
  },
  newProgramBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 2 },
  deleteBtn: {
    borderWidth: 1, borderColor: HAZARD,
    paddingVertical: 14, alignItems: 'center',
  },
  deleteBtnText: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: HAZARD, letterSpacing: 2 },
});
