import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
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
import { FONT_MONO_BOLD, FONT_MONO_MEDIUM, FONT_MONO } from '../../constants/fonts';

type Level = 'débutant' | 'intermédiaire' | 'avancé';
type Goal = 'force' | 'hypertrophie' | 'endurance';
type Equipment = 'haltères' | 'barre' | 'machines' | 'bodyweight' | 'complet';

const LEVELS: { value: Level; label: string }[] = [
  { value: 'débutant', label: 'DÉBUTANT' },
  { value: 'intermédiaire', label: 'INTERMÉDIAIRE' },
  { value: 'avancé', label: 'AVANCÉ' },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'force', label: 'FORCE' },
  { value: 'hypertrophie', label: 'HYPERTROPHIE' },
  { value: 'endurance', label: 'ENDURANCE' },
];

const EQUIPMENTS: { value: Equipment; label: string }[] = [
  { value: 'haltères', label: 'HALTÈRES' },
  { value: 'barre', label: 'BARRE' },
  { value: 'machines', label: 'MACHINES' },
  { value: 'bodyweight', label: 'BODYWEIGHT' },
  { value: 'complet', label: 'COMPLET' },
];

function OptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | '';
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, value === opt.value && styles.optionActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.optionText,
                value === opt.value && styles.optionTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState<Level | ''>('');
  const [goal, setGoal] = useState<Goal | ''>('');
  const [equipment, setEquipment] = useState<Equipment | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    if (!name || !email || !password || !level || !goal || !equipment) {
      setError('TOUS LES CHAMPS SONT REQUIS.');
      return;
    }
    if (password.length < 6) {
      setError('MOT DE PASSE : 6 CARACTÈRES MINIMUM.');
      return;
    }

    setLoading(true);
    setError('');

    // Le profil est passé en metadata — le trigger SQL l'insère côté serveur (security definer)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, level, goal, equipment },
      },
    });

    if (signUpError) {
      setError(signUpError.message.toUpperCase());
      setLoading(false);
      return;
    }

    setLoading(false);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.inner}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.brand}>IRON_TRACK</Text>
          <Text style={styles.subtitle}>NOUVEAU COMPTE</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>NOM</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="John Doe"
              placeholderTextColor={TEXT_SECONDARY}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="utilisateur@email.com"
              placeholderTextColor={TEXT_SECONDARY}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>MOT DE PASSE</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="6 caractères minimum"
              placeholderTextColor={TEXT_SECONDARY}
              secureTextEntry
            />
          </View>

          <OptionPicker
            label="NIVEAU"
            options={LEVELS}
            value={level}
            onChange={setLevel}
          />

          <OptionPicker
            label="OBJECTIF"
            options={GOALS}
            value={goal}
            onChange={setGoal}
          />

          <OptionPicker
            label="ÉQUIPEMENT"
            options={EQUIPMENTS}
            value={equipment}
            onChange={setEquipment}
          />

          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={BACKGROUND} />
            ) : (
              <Text style={styles.btnPrimaryText}>CRÉER MON COMPTE →</Text>
            )}
          </TouchableOpacity>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.btnSecondary} activeOpacity={0.7}>
              <Text style={styles.btnSecondaryText}>J'AI DÉJÀ UN COMPTE</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  inner: {
    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  brand: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 36,
    color: TEXT_PRIMARY,
    letterSpacing: 4,
  },
  subtitle: {
    fontFamily: FONT_MONO,
    fontSize: 11,
    color: TEXT_SECONDARY,
    letterSpacing: 3,
    marginTop: 6,
  },
  form: {
    gap: 16,
  },
  errorBox: {
    backgroundColor: HAZARD + '22',
    borderLeftWidth: 3,
    borderLeftColor: HAZARD,
    padding: 12,
  },
  errorText: {
    fontFamily: FONT_MONO_MEDIUM,
    fontSize: 11,
    color: HAZARD,
    letterSpacing: 1,
  },
  field: {
    gap: 8,
  },
  label: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 2,
  },
  input: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    color: TEXT_PRIMARY,
    fontFamily: FONT_MONO,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  optionText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 10,
    color: TEXT_SECONDARY,
    letterSpacing: 1.5,
  },
  optionTextActive: {
    color: BACKGROUND,
  },
  btnPrimary: {
    backgroundColor: ACCENT,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnPrimaryText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 13,
    color: BACKGROUND,
    letterSpacing: 2,
  },
  btnSecondary: {
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnSecondaryText: {
    fontFamily: FONT_MONO_BOLD,
    fontSize: 13,
    color: TEXT_PRIMARY,
    letterSpacing: 2,
  },
});
