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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    if (!email || !password) {
      setError('EMAIL ET MOT DE PASSE REQUIS.');
      return;
    }

    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message.toUpperCase());
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
          <Text style={styles.subtitle}>SUIVI D'ENTRAÎNEMENT</Text>
        </View>

        <View style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

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
              placeholder="••••••••"
              placeholderTextColor={TEXT_SECONDARY}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={BACKGROUND} />
            ) : (
              <Text style={styles.btnPrimaryText}>SE CONNECTER →</Text>
            )}
          </TouchableOpacity>

          <Link href="/(auth)/register" asChild>
            <TouchableOpacity style={styles.btnSecondary} activeOpacity={0.7}>
              <Text style={styles.btnSecondaryText}>CRÉER UN COMPTE</Text>
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
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 56,
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
    gap: 6,
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
