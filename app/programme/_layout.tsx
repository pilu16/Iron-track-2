import { Stack } from 'expo-router';
import { BACKGROUND } from '../../constants/colors';

export default function ProgrammeLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BACKGROUND } }} />
  );
}
