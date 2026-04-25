import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/theme';

type Props = {
  value: boolean;
  onChange: (v: boolean) => void;
};

export default function AIModeToggle({ value, onChange }: Props) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value]);

  const bg = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#D1D5DB', Colors.accent],
  });

  return (
    <TouchableOpacity onPress={() => onChange(!value)} activeOpacity={0.85}>
      <View style={styles.container}>
        <Animated.View style={[styles.track, { backgroundColor: bg }]}>
          <Animated.View
            style={[
              styles.thumb,
              {
                transform: [
                  {
                    translateX: anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [2, 22],
                    }),
                  },
                ],
              },
            ]}
          />
        </Animated.View>
        <Text style={[styles.label, value && styles.labelActive]}>
          {value ? 'Full AI' : 'Notes only'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  track: {
    width: 44,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  labelActive: {
    color: Colors.accent,
  },
});
