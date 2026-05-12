import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments, SplashScreen } from 'expo-router';
import { useFonts } from 'expo-font';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

if (Platform.OS !== 'web') SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    IBMPlexMono_Regular: require('../assets/fonts/IBMPlexMono_400Regular.ttf'),
    IBMPlexMono_Medium: require('../assets/fonts/IBMPlexMono_500Medium.ttf'),
    IBMPlexMono_Bold: require('../assets/fonts/IBMPlexMono_700Bold.ttf'),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized || !fontsLoaded) return;

    if (Platform.OS !== 'web') SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, initialized, fontsLoaded, segments]);

  if (!initialized || !fontsLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="programme" />
      <Stack.Screen name="workout" />
      <Stack.Screen name="journal" />
    </Stack>
  );
}
