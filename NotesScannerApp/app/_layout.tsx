import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import 'react-native-reanimated';
import { DatabaseProvider } from '../context/DatabaseContext';
import { SessionProvider } from '../context/SessionContext';
import { LLMProvider } from '../context/LLMContext';
import { NetworkProvider } from '../context/NetworkContext';
import NetworkStatusBar from '../components/network-status-bar';
import { Colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <NetworkProvider>
      <DatabaseProvider>
        <SessionProvider>
          <LLMProvider>
            <StatusBar style="dark" />
            <View style={{ flex: 1 }}>
              <Stack
                screenOptions={{
                  headerStyle: { backgroundColor: Colors.surface },
                  headerTintColor: Colors.textPrimary,
                  headerTitleStyle: { fontWeight: '600', fontSize: 17 },
                  headerShadowVisible: false,
                  contentStyle: { backgroundColor: Colors.background },
                }}
              >
                <Stack.Screen name="index" options={{ title: 'My Notes' }} />
                <Stack.Screen name="scan" options={{ title: 'Scan Notes' }} />
                <Stack.Screen name="chat/[id]" options={{ title: '' }} />
                <Stack.Screen name="study-guide/[id]" options={{ title: 'Study Guide' }} />
                <Stack.Screen name="quiz/[id]" options={{ title: 'Quiz' }} />
                <Stack.Screen name="flashcards/[id]" options={{ title: 'Flashcards' }} />
              </Stack>
              <NetworkStatusBar />
            </View>
          </LLMProvider>
        </SessionProvider>
      </DatabaseProvider>
    </NetworkProvider>
  );
}
