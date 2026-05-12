import { Stack } from 'expo-router';
import { BACKGROUND } from '../../constants/colors';

export default function WorkoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BACKGROUND } }} />
  );
}
