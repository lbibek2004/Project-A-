import React, { useCallback } from 'react';
import { StyleSheet, TouchableOpacity, Text, View, Dimensions } from 'react-native';
import Svg, { Polygon, Circle } from 'react-native-svg';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Colors } from '../constants/theme';

export type Corner = { x: number; y: number };

type Props = {
  imageWidth: number;
  imageHeight: number;
  containerWidth: number;
  containerHeight: number;
  onConfirm: (corners: Corner[]) => void;
  onRetry: () => void;
};

const HANDLE_RADIUS = 18;

function clamp(val: number, min: number, max: number) {
  'worklet';
  return Math.max(min, Math.min(max, val));
}

function CornerHandle({
  x,
  y,
  index,
  maxW,
  maxH,
  onMove,
}: {
  x: SharedValue<number>;
  y: SharedValue<number>;
  index: number;
  maxW: number;
  maxH: number;
  onMove: (i: number, cx: number, cy: number) => void;
}) {
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = x.value;
      startY.value = y.value;
    })
    .onUpdate((e) => {
      x.value = clamp(startX.value + e.translationX, 0, maxW);
      y.value = clamp(startY.value + e.translationY, 0, maxH);
      runOnJS(onMove)(index, x.value, y.value);
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value - HANDLE_RADIUS },
      { translateY: y.value - HANDLE_RADIUS },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.handle, style]} />
    </GestureDetector>
  );
}

export default function EdgeAdjustOverlay({
  imageWidth,
  imageHeight,
  containerWidth,
  containerHeight,
  onConfirm,
  onRetry,
}: Props) {
  const w = containerWidth;
  const h = containerHeight;

  // Inset by 10% on each side as default quad
  const pad = 0.1;
  const xs = [
    useSharedValue(w * pad),
    useSharedValue(w * (1 - pad)),
    useSharedValue(w * (1 - pad)),
    useSharedValue(w * pad),
  ];
  const ys = [
    useSharedValue(h * pad),
    useSharedValue(h * pad),
    useSharedValue(h * (1 - pad)),
    useSharedValue(h * (1 - pad)),
  ];

  const corners = xs.map((xv, i) => ({ x: xv, y: ys[i] }));

  const getPoints = useCallback(() => {
    return corners.map((c) => ({
      x: (c.x.value / containerWidth) * imageWidth,
      y: (c.y.value / containerHeight) * imageHeight,
    }));
  }, [corners, containerWidth, containerHeight, imageWidth, imageHeight]);

  const handleMove = useCallback((_i: number, _cx: number, _cy: number) => {
    // just triggers re-render via shared values; no state needed
  }, []);

  const polygonPoints = corners
    .map((c) => `${c.x.value},${c.y.value}`)
    .join(' ');

  return (
    <GestureHandlerRootView style={[styles.container, { width: w, height: h }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Polygon
          points={polygonPoints}
          fill="rgba(74,144,217,0.15)"
          stroke={Colors.accent}
          strokeWidth={2}
        />
        {corners.map((c, i) => (
          <Circle
            key={i}
            cx={c.x.value}
            cy={c.y.value}
            r={HANDLE_RADIUS - 4}
            fill="none"
          />
        ))}
      </Svg>

      {corners.map((c, i) => (
        <CornerHandle
          key={i}
          x={c.x}
          y={c.y}
          index={i}
          maxW={w}
          maxH={h}
          onMove={handleMove}
        />
      ))}

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.btnRetry} onPress={onRetry}>
          <Text style={styles.btnRetryText}>Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnConfirm} onPress={() => onConfirm(getPoints())}>
          <Text style={styles.btnConfirmText}>Use This</Text>
        </TouchableOpacity>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  handle: {
    position: 'absolute',
    width: HANDLE_RADIUS * 2,
    height: HANDLE_RADIUS * 2,
    borderRadius: HANDLE_RADIUS,
    backgroundColor: Colors.accent,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },
  toolbar: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  btnRetry: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  btnRetryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  btnConfirm: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  btnConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
