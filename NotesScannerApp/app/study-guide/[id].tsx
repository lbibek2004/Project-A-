import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { generatePDF } from 'react-native-html-to-pdf';
import * as Sharing from 'expo-sharing';
import StudyGuideCard from '../../components/study-guide-card';
import CountSelector from '../../components/count-selector';
import LoadingOverlay from '../../components/loading-overlay';
import { useDatabase } from '../../context/DatabaseContext';
import { SessionDAO } from '../../lib/database';
import { Colors } from '../../constants/theme';

export default function StudyGuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(id);
  const db = useDatabase();
  const session = SessionDAO.getSessionById(db, sessionId);

  const [quizCount, setQuizCount] = useState(10);
  const [flashCount, setFlashCount] = useState(10);
  const [generating, setGenerating] = useState(false);

  const handlePDF = async () => {
    if (!session?.ocr_text) return;
    setGenerating(true);
    try {
      const html = `
        <html>
          <head>
            <meta charset="UTF-8" />
            <style>
              body { font-family: -apple-system, sans-serif; padding: 40px; color: #1A1A1A; }
              h1 { font-size: 22px; margin-bottom: 8px; }
              p { font-size: 15px; line-height: 1.7; white-space: pre-wrap; }
            </style>
          </head>
          <body>
            <h1>${session.title}</h1>
            <p>${session.ocr_text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
          </body>
        </html>
      `;
      const pdf = await generatePDF({
        html,
        fileName: `notes_${sessionId}`,
        base64: false,
      });
      if (pdf.filePath) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(pdf.filePath, { mimeType: 'application/pdf' });
        } else {
          Alert.alert('Saved', `PDF saved to: ${pdf.filePath}`);
        }
      }
    } catch (e: any) {
      Alert.alert('PDF Error', e?.message ?? 'Could not generate PDF.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>STUDY TOOLS</Text>

      <StudyGuideCard
        icon="document-text-outline"
        title="Download PDF"
        description="Save your notes as a formatted PDF to read or share."
        onPress={handlePDF}
      />

      <StudyGuideCard
        icon="help-circle-outline"
        title="Quiz Me"
        description="Test your knowledge with multiple-choice questions."
        onPress={() => router.push(`/quiz/${sessionId}?count=${quizCount}`)}
      >
        <View style={styles.countRow}>
          <Text style={styles.countLabel}>Questions:</Text>
          <CountSelector value={quizCount} min={5} max={20} onChange={setQuizCount} />
        </View>
      </StudyGuideCard>

      <StudyGuideCard
        icon="layers-outline"
        title="Flashcards"
        description="Flip through term/answer cards to reinforce memory."
        onPress={() => router.push(`/flashcards/${sessionId}?count=${flashCount}`)}
      >
        <View style={styles.countRow}>
          <Text style={styles.countLabel}>Cards:</Text>
          <CountSelector value={flashCount} min={5} max={20} onChange={setFlashCount} />
        </View>
      </StudyGuideCard>

      <LoadingOverlay visible={generating} message="Generating PDF…" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, gap: 14 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
