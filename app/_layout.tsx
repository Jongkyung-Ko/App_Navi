import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#f4f1ea' },
          headerTintColor: '#1a2332',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#f4f1ea' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'App Navi' }} />
        <Stack.Screen name="complexes" options={{ title: '주변 단지 시세' }} />
        <Stack.Screen name="complex/[id]" options={{ title: '단지 상세' }} />
        <Stack.Screen name="settings" options={{ title: '설정' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
