import { Stack } from 'expo-router';
import { BACKGROUND } from '../../constants/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: BACKGROUND },
        animation: 'fade',
      }}
    />
  );
}
