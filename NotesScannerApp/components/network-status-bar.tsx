import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useNetwork } from '../context/NetworkContext';

export default function NetworkStatusBar() {
  const { showOnlineBanner, dismissOnlineBanner } = useNetwork();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!showOnlineBanner) return;

    opacity.setValue(1);
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start(() => dismissOnlineBanner());
    }, 900);

    return () => clearTimeout(timer);
  }, [showOnlineBanner]);

  if (!showOnlineBanner) return null;

  return (
    <Animated.View style={[styles.bar, { opacity }]}>
      <Text style={styles.text}>Switched to online mode</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#34A853',
    paddingVertical: 8,
    alignItems: 'center',
    zIndex: 999,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
