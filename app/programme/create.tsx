import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { BACKGROUND, ACCENT, HAZARD, TEXT_PRIMARY, TEXT_SECONDARY, BORDER, SURFACE } from '../../constants/colors';
import { FONT_MONO_BOLD, FONT_MONO } from '../../constants/fonts';

export default function CreateProgramScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progType, setProgType] = useState<'double' | 'linear' | 'rep_per_session'>('double');

  async function handleCreate() {
    if (!name.trim()) { setError('NOM REQUIS.'); return; }
    setLoading(true);
    setError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Désactiver les autres programmes
    await supabase.from('programs').update({ is_active: false }).eq('user_id', user.id);

    const { data, error: err } = await supabase
      .from('programs')
      .insert({ user_id: user.id, name: name.trim(), is_active: true, progression_type: progType })
      .select()
      .single();

    if (err) { setError(err.message.toUpperCase()); setLoading(false); return; }

    router.replace(`/programme/${data.id}`);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← RETOUR</Text>
        </TouchableOpacity>

        <Text style={styles.title}>NOUVEAU{'\n'}PROGRAMME.</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>NOM DU PROGRAMME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="ex: PUSH PULL LEGS"
            placeholderTextColor={TEXT_SECONDARY}
            autoCapitalize="characters"
            autoFocus
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>TYPE DE PROGRESSION</Text>
          <View style={styles.optionRow}>
            {([
              { value: 'double' as const, label: 'DOUBLE', sub: 'Poids +X kg quand toutes les séries réussies' },
              { value: 'linear' as const, label: 'LINÉAIRE', sub: 'Poids augmente toutes les X semaines' },
              { value: 'rep_per_session' as const, label: 'REP / SÉANCE', sub: '+1 répétition à chaque séance' },
            ]).map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.option, progType === opt.value && styles.optionActive]}
                onPress={() => setProgType(opt.value)}
              >
                <Text style={[styles.optionLabel, progType === opt.value && styles.optionLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={[styles.optionSub, progType === opt.value && styles.optionSubActive]}>
                  {opt.sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && { opacity: 0.5 }]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color={BACKGROUND} /> : <Text style={styles.btnText}>CRÉER →</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  inner: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 40, gap: 24 },
  back: { alignSelf: 'flex-start' },
  backText: { fontFamily: FONT_MONO, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 2 },
  title: { fontFamily: FONT_MONO_BOLD, fontSize: 36, color: TEXT_PRIMARY, letterSpacing: 2, lineHeight: 44 },
  errorBox: { backgroundColor: HAZARD + '22', borderLeftWidth: 3, borderLeftColor: HAZARD, padding: 12 },
  errorText: { fontFamily: FONT_MONO, fontSize: 11, color: HAZARD, letterSpacing: 1 },
  field: { gap: 8 },
  label: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 2 },
  input: {
    backgroundColor: SURFACE, borderWidth: 1, borderColor: BORDER,
    color: TEXT_PRIMARY, fontFamily: FONT_MONO, fontSize: 16,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  btn: { backgroundColor: ACCENT, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { fontFamily: FONT_MONO_BOLD, fontSize: 13, color: BACKGROUND, letterSpacing: 2 },
  field: { gap: 8 },
  label: { fontFamily: FONT_MONO_BOLD, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 2 },
  optionRow: { gap: 6 },
  option: { borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 12, gap: 3 },
  optionActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  optionLabel: { fontFamily: FONT_MONO_BOLD, fontSize: 11, color: TEXT_SECONDARY, letterSpacing: 1.5 },
  optionLabelActive: { color: BACKGROUND },
  optionSub: { fontFamily: FONT_MONO, fontSize: 10, color: TEXT_SECONDARY, letterSpacing: 0.5 },
  optionSubActive: { color: BACKGROUND },
});
