import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREF_KEY = '@offline_pref'; // values: 'always_offline' | 'ask' | (unset)

export type NetworkMode = 'online' | 'offline';

type NetworkContextValue = {
  mode: NetworkMode;
  isConnected: boolean;
  showOnlineBanner: boolean;
  dismissOnlineBanner: () => void;
  forceOffline: () => void;
  clearForceOffline: () => void;
  isForcedOffline: boolean;
};

const NetworkContext = createContext<NetworkContextValue>({
  mode: 'online',
  isConnected: true,
  showOnlineBanner: false,
  dismissOnlineBanner: () => {},
  forceOffline: () => {},
  clearForceOffline: () => {},
  isForcedOffline: false,
});

export function useNetwork() {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);
  const [forcedOffline, setForcedOffline] = useState(false);
  const [showOnlineBanner, setShowOnlineBanner] = useState(false);

  // Loaded from AsyncStorage on mount — read synchronously from ref in callbacks
  const prefRef = useRef<string | null>(null);
  const dialogShownThisSession = useRef(false);
  const prevConnected = useRef<boolean | null>(null);

  // Load persisted preference once on mount
  useEffect(() => {
    AsyncStorage.getItem(PREF_KEY).then((val) => {
      prefRef.current = val;
    });
  }, []);

  const mode: NetworkMode =
    !isConnected || forcedOffline ? 'offline' : 'online';

  const dismissOnlineBanner = useCallback(() => setShowOnlineBanner(false), []);
  const forceOffline = useCallback(() => setForcedOffline(true), []);
  const clearForceOffline = useCallback(() => setForcedOffline(false), []);

  const handleOfflineDetected = useCallback(() => {
    if (prefRef.current === 'always_offline') return;
    if (dialogShownThisSession.current) return;

    dialogShownThisSession.current = true;

    Alert.alert(
      "You're offline",
      'The app will run in offline mode. Responses may be slower since AI runs on your device.',
      [
        {
          text: 'Wait for Connection',
          style: 'cancel',
          onPress: () => {
            dialogShownThisSession.current = false;
          },
        },
        {
          text: 'Use Offline Mode',
          onPress: () => {
            Alert.alert(
              'Set as default?',
              'Always use offline mode when you have no connection?',
              [
                {
                  text: 'No, ask me next time',
                  style: 'cancel',
                  onPress: () => {
                    prefRef.current = 'ask';
                    AsyncStorage.setItem(PREF_KEY, 'ask');
                    dialogShownThisSession.current = false;
                  },
                },
                {
                  text: 'Yes, always offline',
                  onPress: () => {
                    prefRef.current = 'always_offline';
                    AsyncStorage.setItem(PREF_KEY, 'always_offline');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = state.isConnected ?? false;
      setIsConnected(connected);

      if (prevConnected.current === false && connected) {
        // offline → online
        setForcedOffline(false);
        setShowOnlineBanner(true);
      } else if (prevConnected.current !== false && !connected) {
        // online → offline (or initial offline)
        handleOfflineDetected();
      }

      prevConnected.current = connected;
    });

    return unsubscribe;
  }, [handleOfflineDetected]);

  return (
    <NetworkContext.Provider
      value={{
        mode,
        isConnected,
        showOnlineBanner,
        dismissOnlineBanner,
        forceOffline,
        clearForceOffline,
        isForcedOffline: forcedOffline,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}
