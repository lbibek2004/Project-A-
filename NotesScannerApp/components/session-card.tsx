import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Session } from '../lib/database';
import { Colors } from '../constants/theme';

type Props = {
  session: Session;
  onPress: () => void;
  onDelete: () => void;
};

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'long' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function SessionCard({ session, onPress, onDelete }: Props) {
  const preview = session.ocr_text.slice(0, 80).replace(/\n/g, ' ').trim();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onDelete} activeOpacity={0.75}>
      <View style={styles.iconWrap}>
        <Ionicons
          name={session.source === 'upload' ? 'image-outline' : 'camera-outline'}
          size={22}
          color={Colors.accent}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {session.title}
        </Text>
        {preview ? (
          <Text style={styles.preview} numberOfLines={2}>
            {preview}
          </Text>
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text style={styles.date}>{formatDate(session.updated_at)}</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.border} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, gap: 3 },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  preview: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  date: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
