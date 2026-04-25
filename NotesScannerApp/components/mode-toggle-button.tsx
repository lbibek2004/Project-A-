import React from 'react';
import { Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../context/NetworkContext';
import { Colors } from '../constants/theme';

export default function ModeToggleButton() {
  const { mode, isConnected, isForcedOffline, forceOffline, clearForceOffline } = useNetwork();

  const handlePress = () => {
    if (!isConnected) {
      Alert.alert('No connection', 'No internet connection is available right now.');
      return;
    }

    if (isForcedOffline) {
      clearForceOffline();
    } else {
      forceOffline();
    }
  };

  const isEffectivelyOffline = mode === 'offline';

  return (
    <TouchableOpacity onPress={handlePress} style={{ padding: 4 }} hitSlop={8}>
      <Ionicons
        name={isEffectivelyOffline ? 'wifi-outline' : 'wifi'}
        size={20}
        color={isEffectivelyOffline ? Colors.textSecondary : Colors.accent}
      />
    </TouchableOpacity>
  );
}
