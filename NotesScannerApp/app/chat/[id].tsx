import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ChatBubble from '../../components/chat-bubble';
import AIModeToggle from '../../components/ai-mode-toggle';
import LoadingOverlay from '../../components/loading-overlay';
import { useSession } from '../../context/SessionContext';
import { useDatabase } from '../../context/DatabaseContext';
import { useLLMContext } from '../../context/LLMContext';
import { useNetwork } from '../../context/NetworkContext';
import { SessionDAO } from '../../lib/database';
import { askQuestion } from '../../lib/llm';
import { geminiAsk } from '../../lib/gemini';
import ModeToggleButton from '../../components/mode-toggle-button';
import { Colors } from '../../constants/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const navigation = useNavigation();
  const db = useDatabase();
  const { messages, loadMessages, addMessage, currentSession, refreshCurrentSession } =
    useSession();

  const { generate, status, downloadProgress, error: llmError } = useLLMContext();
  const { mode } = useNetwork();

  const [fullAi, setFullAi] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  // Refresh messages and session data whenever this screen gains focus (e.g. returning from scan)
  useFocusEffect(
    useCallback(() => {
      loadMessages(sessionId);
      refreshCurrentSession(sessionId);
    }, [sessionId, loadMessages, refreshCurrentSession])
  );

  const session = currentSession ?? SessionDAO.getSessionById(db, sessionId);
  const imageUris: string[] = JSON.parse(session?.image_uris ?? '[]');

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () =>
        editingTitle ? (
          <TextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            onBlur={saveTitle}
            onSubmitEditing={saveTitle}
            autoFocus
            style={styles.titleInput}
            returnKeyType="done"
          />
        ) : (
          <TouchableOpacity onPress={startEditTitle}>
            <Text style={styles.titleText} numberOfLines={1}>
              {session?.title ?? 'Chat'}
            </Text>
          </TouchableOpacity>
        ),
      headerRight: () => (
        <View style={styles.headerRight}>
          <ModeToggleButton />
          <AIModeToggle value={fullAi} onChange={setFullAi} />
          <TouchableOpacity
            onPress={() => router.push(`/study-guide/${sessionId}`)}
            style={styles.studyBtn}
          >
            <Ionicons name="book-outline" size={20} color={Colors.accent} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [session?.title, editingTitle, titleDraft, fullAi]);

  const startEditTitle = () => {
    setTitleDraft(session?.title ?? '');
    setEditingTitle(true);
  };

  const saveTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== session?.title) {
      SessionDAO.updateSessionTitle(db, sessionId, t);
      refreshCurrentSession(sessionId);
    }
    setEditingTitle(false);
  };

  const sendMessage = useCallback(async () => {
    const q = input.trim();
    if (!q || thinking) return;
    if (mode === 'offline' && status !== 'ready') {
      Alert.alert('Model loading', `AI model is still loading (${Math.round(downloadProgress * 100)}%). Please wait.`);
      return;
    }
    // Read fresh OCR text from DB so appended images are always included
    const freshSession = SessionDAO.getSessionById(db, sessionId);
    if (!freshSession?.ocr_text) {
      Alert.alert('No notes', 'No extracted text found for this session.');
      return;
    }
    setInput('');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addMessage(sessionId, 'user', q);
    setThinking(true);
    try {
      const answer =
        mode === 'online'
          ? await geminiAsk(freshSession.ocr_text, q, fullAi)
          : await askQuestion(freshSession.ocr_text, q, fullAi, generate);
      addMessage(sessionId, 'assistant', answer);
    } catch (e: any) {
      addMessage(sessionId, 'assistant', `Error: ${e?.message ?? 'Could not get a response.'}`);
    } finally {
      setThinking(false);
    }
  }, [input, thinking, db, sessionId, fullAi, addMessage, generate, status, downloadProgress, mode]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const ImageHeader = imageUris.length > 0 ? () => (
    <View style={styles.imageBubbleRow}>
      {imageUris.map((uri, i) => (
        <Image key={i} source={{ uri }} style={styles.imageBubbleThumb} resizeMode="cover" />
      ))}
    </View>
  ) : undefined;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {mode === 'offline' && status !== 'ready' && (
        <View style={styles.modelBanner}>
          <Text style={styles.modelBannerText}>
            {status === 'downloading'
              ? `Downloading AI model… ${Math.round(downloadProgress * 100)}%`
              : status === 'loading'
              ? 'Initializing AI model…'
              : status === 'error'
              ? `AI model error: ${llmError}`
              : 'Preparing AI model…'}
          </Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        ListHeaderComponent={ImageHeader}
        ListEmptyComponent={!thinking ? () => (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>Ask about your notes</Text>
            <Text style={styles.emptySub}>
              Type any question and the AI will answer based on the scanned text.
            </Text>
          </View>
        ) : null}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={[styles.list, { flexGrow: 1 }]}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
      />

      {thinking && (
        <View style={styles.typingRow}>
          <View style={styles.typingBubble}>
            <Text style={styles.typingText}>Thinking…</Text>
          </View>
        </View>
      )}

      <View style={styles.inputBar}>
        <TouchableOpacity
          style={styles.addImageBtn}
          onPress={() => router.push(`/scan?appendTo=${sessionId}`)}
        >
          <Ionicons name="camera-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask a question…"
          placeholderTextColor={Colors.textSecondary}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || thinking) && styles.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!input.trim() || thinking}
        >
          <Ionicons name="arrow-up" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <LoadingOverlay visible={false} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  modelBanner: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  modelBannerText: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center' },
  list: { paddingTop: 12, paddingBottom: 8 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  imageBubbleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  imageBubbleThumb: {
    width: 160,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typingRow: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  typingBubble: {
    backgroundColor: Colors.assistantBubble,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  typingText: { color: Colors.textSecondary, fontSize: 14 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  addImageBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.textPrimary,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: Colors.border },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 4,
  },
  studyBtn: {
    padding: 4,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    maxWidth: 180,
  },
  titleInput: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
    minWidth: 120,
    maxWidth: 200,
    paddingVertical: 2,
  },
});
