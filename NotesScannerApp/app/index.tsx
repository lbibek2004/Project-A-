import React, { useCallback, useEffect, useLayoutEffect } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import SessionCard from '../components/session-card';
import ModeToggleButton from '../components/mode-toggle-button';
import { useSession } from '../context/SessionContext';
import { useLLMContext } from '../context/LLMContext';
import { Colors } from '../constants/theme';

export default function HomeScreen() {
  const { sessions, loadSessions, deleteSession } = useSession();
  const { status, downloadProgress, error: llmError, modelExists, startDownload } = useLLMContext();
  const navigation = useNavigation();

  // Prompt once per launch until the model is on disk
  useEffect(() => {
    if (modelExists !== false) return;
    Alert.alert(
      'Download Offline AI Model',
      'To use offline mode, the app needs to download a ~3 GB AI model. This only happens once.\n\nDownload now while connected to Wi-Fi?',
      [
        { text: 'Later', style: 'cancel' },
        { text: 'Download', onPress: startDownload },
      ]
    );
  }, [modelExists]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <ModeToggleButton />,
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [loadSessions])
  );

  const confirmDelete = (id: number, title: string) => {
    Alert.alert(
      'Delete session?',
      `"${title}" and all its messages will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteSession(id),
        },
      ]
    );
  };

  const showModelBanner = status === 'downloading' || status === 'loading' || status === 'error';

  return (
    <View style={styles.container}>
      {showModelBanner && (
        <View style={[styles.modelBanner, status === 'error' && styles.modelBannerError]}>
          <Ionicons
            name={status === 'error' ? 'alert-circle-outline' : 'cloud-download-outline'}
            size={16}
            color={status === 'error' ? Colors.danger : Colors.accent}
          />
          <Text style={[styles.modelBannerText, status === 'error' && styles.modelBannerTextError]}>
            {status === 'downloading'
              ? `Downloading AI model… ${Math.round(downloadProgress * 100)}%`
              : status === 'loading'
              ? 'Initializing AI model…'
              : status === 'error'
              ? `Model error: ${llmError ?? 'unknown'}`
              : 'Preparing offline AI model…'}
          </Text>
          {status === 'downloading' && (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(downloadProgress * 100)}%` as any }]} />
            </View>
          )}
          {status === 'error' && (
            <TouchableOpacity onPress={startDownload} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={64} color={Colors.border} />
          <Text style={styles.emptyTitle}>No notes yet</Text>
          <Text style={styles.emptySub}>
            Tap the + button to scan or upload your first set of notes.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(s) => String(s.id)}
          renderItem={({ item }) => (
            <SessionCard
              session={item}
              onPress={() => router.push(`/chat/${item.id}`)}
              onDelete={() => confirmDelete(item.id, item.title)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/scan')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 100 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  modelBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexWrap: 'wrap',
  },
  modelBannerError: {
    backgroundColor: '#FEF2F2',
    borderBottomColor: '#FECACA',
  },
  modelBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  modelBannerTextError: {
    color: Colors.danger,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.accent,
    borderRadius: 2,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: Colors.danger,
    borderRadius: 6,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
