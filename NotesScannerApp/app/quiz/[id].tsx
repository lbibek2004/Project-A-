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
import RadioOption from '../../components/radio-option';
import LoadingOverlay from '../../components/loading-overlay';
import { useDatabase } from '../../context/DatabaseContext';
import { useLLMContext } from '../../context/LLMContext';
import { useNetwork } from '../../context/NetworkContext';
import { SessionDAO, QuizResultDAO } from '../../lib/database';
import { generateQuiz, QuizQuestion } from '../../lib/llm';
import { geminiGenerateQuiz } from '../../lib/gemini';
import { Colors } from '../../constants/theme';

type Stage = 'loading' | 'active' | 'complete';

export default function QuizScreen() {
  const { id, count } = useLocalSearchParams<{ id: string; count?: string }>();
  const sessionId = Number(id);
  const questionCount = Math.max(5, Math.min(20, Number(count ?? 10)));
  const db = useDatabase();
  const { generate, status, downloadProgress, error: llmError } = useLLMContext();
  const { mode } = useNetwork();
  const session = SessionDAO.getSessionById(db, sessionId);

  const [stage, setStage] = useState<Stage>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [missed, setMissed] = useState<QuizQuestion[]>([]);

  useEffect(() => {
    if (mode === 'offline' && status !== 'ready') return;
    if (!session?.ocr_text) {
      Alert.alert('Error', 'No notes found.', [{ text: 'OK', onPress: () => router.back() }]);
      return;
    }
    const gen =
      mode === 'online'
        ? geminiGenerateQuiz(session.ocr_text, questionCount)
        : generateQuiz(session.ocr_text, questionCount, generate);
    gen
      .then((qs) => {
        if (qs.length === 0) throw new Error('No questions generated. Try again.');
        setQuestions(qs);
        setStage('active');
      })
      .catch((e: any) => {
        Alert.alert('Error', e?.message ?? 'Failed to generate quiz.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      });
  }, [status, mode]);

  const handleSelect = (opt: string) => {
    if (revealed) return;
    setSelected(opt);
  };

  const handleReveal = () => {
    if (!selected) return;
    setRevealed(true);
    const q = questions[qIndex];
    const isCorrect = selected === q.answer;
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setScore((s) => s + 1);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMissed((m) => [...m, q]);
    }
  };

  const handleNext = () => {
    const nextIndex = qIndex + 1;
    if (nextIndex >= questions.length) {
      finishQuiz();
    } else {
      setQIndex(nextIndex);
      setSelected(null);
      setRevealed(false);
    }
  };

  const finishQuiz = () => {
    const finalScore = score + (selected === questions[qIndex]?.answer && revealed ? 0 : 0);
    QuizResultDAO.saveQuizResult(
      db,
      sessionId,
      score,
      questions.length,
      JSON.stringify(missed)
    );
    setStage('complete');
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

  if (stage === 'loading') return <LoadingOverlay visible message="Generating quiz…" />;

  if (stage === 'complete') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreEmoji}>{score / questions.length >= 0.7 ? '🎉' : '📚'}</Text>
          <Text style={styles.scoreTitle}>Quiz Complete!</Text>
          <Text style={styles.scoreNum}>
            {score} / {questions.length} correct
          </Text>
        </View>

        {missed.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>REVIEW MISSED QUESTIONS</Text>
            {missed.map((q, i) => (
              <View key={i} style={styles.missedCard}>
                <Text style={styles.missedQ}>{q.question}</Text>
                <Text style={styles.missedA}>Answer: {q.answer}</Text>
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

  const q = questions[qIndex];
  const progress = `${qIndex + 1} / ${questions.length}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>{progress}</Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((qIndex + 1) / questions.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      <Text style={styles.question}>{q.question}</Text>

      <View style={styles.options}>
        {q.options.map((opt, i) => (
          <RadioOption
            key={i}
            index={i}
            label={opt}
            selected={selected === opt}
            correct={revealed && opt === q.answer}
            incorrect={revealed && selected === opt && opt !== q.answer}
            onSelect={() => handleSelect(opt)}
            disabled={revealed}
          />
        ))}
      </View>

      {!revealed ? (
        <TouchableOpacity
          style={[styles.actionBtn, !selected && styles.actionBtnDisabled]}
          onPress={handleReveal}
          disabled={!selected}
        >
          <Text style={styles.actionBtnText}>Check Answer</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.actionBtn} onPress={handleNext}>
          <Text style={styles.actionBtnText}>
            {qIndex + 1 < questions.length ? 'Next Question →' : 'See Results'}
          </Text>
        </TouchableOpacity>
      )}
    </ScrollView>
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
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  progressRow: { gap: 8 },
  progressText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'right' },
  progressTrack: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },
  question: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 26,
  },
  options: { gap: 10 },
  actionBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  actionBtnDisabled: { backgroundColor: Colors.border },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
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
    marginTop: 8,
  },
  missedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  missedQ: { fontSize: 15, fontWeight: '500', color: Colors.textPrimary },
  missedA: { fontSize: 14, color: Colors.accent, fontWeight: '500' },
  doneBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
