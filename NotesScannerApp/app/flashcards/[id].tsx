import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import FlipCard from '../../components/flip-card';
import LoadingOverlay from '../../components/loading-overlay';
import { useDatabase } from '../../context/DatabaseContext';
import { useLLMContext } from '../../context/LLMContext';
import { useNetwork } from '../../context/NetworkContext';
import { SessionDAO, FlashcardResultDAO } from '../../lib/database';
import { generateFlashcards, FlashCard } from '../../lib/llm';
import { geminiGenerateFlashcards } from '../../lib/gemini';
import { Colors } from '../../constants/theme';

type Stage = 'loading' | 'active' | 'complete';

export default function FlashcardsScreen() {
  const { id, count } = useLocalSearchParams<{ id: string; count?: string }>();
  const sessionId = Number(id);
  const cardCount = Math.max(5, Math.min(20, Number(count ?? 10)));
  const db = useDatabase();
  const { generate, status, downloadProgress, error: llmError } = useLLMContext();
  const { mode } = useNetwork();
  const session = SessionDAO.getSessionById(db, sessionId);

  const [stage, setStage] = useState<Stage>('loading');
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<FlashCard[]>([]);

  useEffect(() => {
    if (mode === 'offline' && status !== 'ready') return;
    if (!session?.ocr_text) {
      Alert.alert('Error', 'No notes found.', [{ text: 'OK', onPress: () => router.back() }]);
      return;
    }
    const gen =
      mode === 'online'
        ? geminiGenerateFlashcards(session.ocr_text, cardCount)
        : generateFlashcards(session.ocr_text, cardCount, generate);
    gen
      .then((cs) => {
        if (cs.length === 0) throw new Error('No flashcards generated. Try again.');
        setCards(cs);
        setStage('active');
      })
      .catch((e: any) => {
        Alert.alert('Error', e?.message ?? 'Failed to generate flashcards.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      });
  }, [status, mode]);

  const handleFlip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsFlipped((f) => !f);
  };

  const handleResult = (gotIt: boolean) => {
    const card = cards[cardIndex];
    if (gotIt) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScore((s) => s + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMissed((m) => [...m, card]);
    }
    const nextIndex = cardIndex + 1;
    if (nextIndex >= cards.length) {
      FlashcardResultDAO.saveFlashcardResult(
        db,
        sessionId,
        gotIt ? score + 1 : score,
        cards.length,
        JSON.stringify(gotIt ? missed : [...missed, card])
      );
      setStage('complete');
    } else {
      setCardIndex(nextIndex);
      setIsFlipped(false);
    }
  };

  // Show model status instead of spinning when offline model isn't ready
  if (mode === 'offline' && status !== 'ready') {
    return (
      <View style={styles.modelStatus}>
        {status === 'error' ? (
          <>
            <Ionicons name="alert-circle-outline" size={40} color={Colors.danger} />
            <Text style={styles.modelStatusError}>
              {`Offline AI model failed to load:\n${llmError ?? 'Unknown error'}`}
            </Text>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>Go Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Ionicons name="cloud-download-outline" size={40} color={Colors.accent} />
            <Text style={styles.modelStatusText}>
              {status === 'downloading'
                ? `Downloading AI model… ${Math.round(downloadProgress * 100)}%`
                : status === 'loading'
                ? 'Initializing AI model…'
                : 'Preparing offline AI model…'}
            </Text>
          </>
        )}
      </View>
    );
  }

  if (stage === 'loading') return <LoadingOverlay visible message="Generating flashcards…" />;

  if (stage === 'complete') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreEmoji}>{score / cards.length >= 0.7 ? '🎉' : '📚'}</Text>
          <Text style={styles.scoreTitle}>Nice work!</Text>
          <Text style={styles.scoreNum}>
            {score} / {cards.length} got it
          </Text>
        </View>

        {missed.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>REVIEW MISSED CARDS</Text>
            {missed.map((c, i) => (
              <View key={i} style={styles.missedCard}>
                <Text style={styles.missedFront}>{c.front}</Text>
                <Text style={styles.missedBack}>{c.back}</Text>
              </View>
            ))}
          </>
        )}

        <TouchableOpacity
          style={styles.doneBtn}
          onPress={() => router.replace(`/chat/${sessionId}`)}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  const card = cards[cardIndex];
  const progress = `${cardIndex + 1} / ${cards.length}`;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>{progress}</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${((cardIndex + 1) / cards.length) * 100}%` },
              ]}
            />
          </View>
        </View>

        <FlipCard
          front={card.front}
          back={card.back}
          isFlipped={isFlipped}
          onFlip={handleFlip}
        />

        {!isFlipped ? (
          <TouchableOpacity style={styles.revealBtn} onPress={handleFlip}>
            <Text style={styles.revealBtnText}>Reveal Answer</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.feedbackRow}>
            <TouchableOpacity
              style={[styles.feedbackBtn, styles.missedBtn]}
              onPress={() => handleResult(false)}
            >
              <Text style={styles.missedBtnText}>Missed it</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.feedbackBtn, styles.gotItBtn]}
              onPress={() => handleResult(true)}
            >
              <Text style={styles.gotItBtnText}>Got it!</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.hint}>
          {isFlipped ? 'Tap the card to flip back' : 'Tap the card to flip'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  modelStatus: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  modelStatusText: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center' },
  modelStatusError: { fontSize: 15, color: Colors.danger, textAlign: 'center' },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backBtnText: { color: Colors.textPrimary, fontWeight: '600' },
  content: { flex: 1, padding: 20, gap: 20 },
  progressRow: { gap: 8 },
  progressText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'right' },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },
  revealBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  revealBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  feedbackRow: {
    flexDirection: 'row',
    gap: 12,
  },
  feedbackBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  missedBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: Colors.danger,
  },
  missedBtnText: { color: Colors.danger, fontWeight: '600', fontSize: 16 },
  gotItBtn: {
    backgroundColor: '#F0FDF4',
    borderColor: Colors.success,
  },
  gotItBtnText: { color: Colors.success, fontWeight: '600', fontSize: 16 },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  scoreCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scoreEmoji: { fontSize: 48 },
  scoreTitle: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary },
  scoreNum: { fontSize: 17, color: Colors.textSecondary },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  missedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  missedFront: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  missedBack: { fontSize: 14, color: Colors.accent, fontWeight: '500' },
  doneBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
