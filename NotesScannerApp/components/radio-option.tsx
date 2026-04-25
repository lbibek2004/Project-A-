import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/theme';

const LABELS = ['A', 'B', 'C', 'D'];

type Props = {
  index: number;
  label: string;
  selected: boolean;
  correct?: boolean;   // shown after reveal
  incorrect?: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

export default function RadioOption({ index, label, selected, correct, incorrect, onSelect, disabled }: Props) {
  let borderColor = Colors.border;
  let bgColor = Colors.surface;
  let textColor = Colors.textPrimary;

  if (correct) {
    borderColor = Colors.success;
    bgColor = '#F0FDF4';
  } else if (incorrect) {
    borderColor = Colors.danger;
    bgColor = '#FEF2F2';
  } else if (selected) {
    borderColor = Colors.accent;
    bgColor = '#EBF4FF';
  }

  return (
    <TouchableOpacity
      style={[styles.row, { borderColor, backgroundColor: bgColor }]}
      onPress={onSelect}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <View style={[styles.letter, selected && !correct && !incorrect && styles.letterSelected, correct && styles.letterCorrect, incorrect && styles.letterIncorrect]}>
        <Text style={styles.letterText}>{LABELS[index] ?? String.fromCharCode(65 + index)}</Text>
      </View>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 12,
  },
  letter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  letterSelected: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  letterCorrect: { backgroundColor: Colors.success, borderColor: Colors.success },
  letterIncorrect: { backgroundColor: Colors.danger, borderColor: Colors.danger },
  letterText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  label: { fontSize: 15, flex: 1, lineHeight: 21 },
});
