import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Colors } from '../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 48;
const CARD_H = 240;

type Props = {
  front: string;
  back: string;
  isFlipped: boolean;
  onFlip: () => void;
};

export default function FlipCard({ front, back, isFlipped, onFlip }: React.PropsWithoutRef<Props>) {
  const rotation = useSharedValue(isFlipped ? 1 : 0);

  React.useEffect(() => {
    rotation.value = withTiming(isFlipped ? 1 : 0, { duration: 380 });
  }, [isFlipped]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(rotation.value, [0, 1], [0, 180])}deg` }],
    backfaceVisibility: 'hidden',
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotateY: `${interpolate(rotation.value, [0, 1], [180, 360])}deg` }],
    backfaceVisibility: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
  }));

  return (
    <TouchableOpacity onPress={onFlip} activeOpacity={0.92} style={styles.wrapper}>
      <View style={styles.container}>
        <Animated.View style={[styles.card, styles.frontCard, frontStyle]}>
          <Text style={styles.tag}>QUESTION</Text>
          <Text style={styles.cardText}>{front}</Text>
        </Animated.View>
        <Animated.View style={[styles.card, styles.backCard, backStyle]}>
          <Text style={styles.tag}>ANSWER</Text>
          <Text style={styles.cardText}>{back}</Text>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'center' },
  container: {
    width: CARD_W,
    height: CARD_H,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
  },
  frontCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  backCard: {
    backgroundColor: '#EBF4FF',
    borderColor: Colors.accent,
  },
  tag: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1,
    position: 'absolute',
    top: 14,
    left: 20,
  },
  cardText: {
    fontSize: 17,
    fontWeight: '500',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 25,
  },
});
