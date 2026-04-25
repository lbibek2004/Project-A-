import React, { useState, useRef } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import EdgeAdjustOverlay, { Corner } from '../components/edge-adjust-overlay';
import LoadingOverlay from '../components/loading-overlay';
import { recognizeFromCamera, recognizeFromUpload } from '../lib/ocr';
import { ocrWithCloudVision } from '../lib/cloudvision';
import { useSession } from '../context/SessionContext';
import { useNetwork } from '../context/NetworkContext';
import { Colors } from '../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Stage = 'camera' | 'adjust' | 'processing';

async function copyToDocuments(uri: string): Promise<string> {
  const dir = FileSystem.documentDirectory + 'note_images/';
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = dir + Date.now() + '.jpg';
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const { createSession, appendImage } = useSession();
  const { appendTo } = useLocalSearchParams<{ appendTo?: string }>();
  const appendToId = appendTo ? Number(appendTo) : null;

  const [stage, setStage] = useState<Stage>('camera');
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [capturedW, setCapturedW] = useState(SCREEN_W);
  const [capturedH, setCapturedH] = useState(SCREEN_H);
  const [isUpload, setIsUpload] = useState(false);
  const { mode } = useNetwork();

  const goToChat = (ocrText: string, source: 'camera' | 'upload', imageUri: string) => {
    const id = createSession(ocrText, source, imageUri);
    router.replace(`/chat/${id}`);
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (!photo) return;
      setCapturedUri(photo.uri);
      setCapturedW(photo.width);
      setCapturedH(photo.height);
      setIsUpload(false);
      setStage('adjust');
    } catch (e) {
      Alert.alert('Error', 'Failed to take picture.');
    }
  };

  const handleUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    });
    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const ext = (asset.uri.split('.').pop() ?? '').toLowerCase();
    const allowed = ['jpg', 'jpeg', 'png', 'heic', 'webp'];
    if (!allowed.includes(ext)) {
      Alert.alert('Unsupported format', 'Please select a JPG, PNG, HEIC, or WebP image.');
      return;
    }
    setCapturedUri(asset.uri);
    setCapturedW(asset.width ?? SCREEN_W);
    setCapturedH(asset.height ?? SCREEN_H);
    setIsUpload(true);
    setStage('adjust');
  };

  const handleConfirmEdges = async (_corners: Corner[]) => {
    if (!capturedUri) return;
    setStage('processing');
    try {
      let text: string;
      if (mode === 'online') {
        text = await ocrWithCloudVision(capturedUri);
      } else if (isUpload) {
        text = await recognizeFromUpload(capturedUri);
      } else {
        text = await recognizeFromCamera(capturedUri);
      }
      if (!text.trim()) {
        Alert.alert('No text found', 'Could not extract text from this image. Try again with a clearer photo.', [
          { text: 'OK', onPress: () => setStage('camera') },
        ]);
        return;
      }
      const permanentUri = await copyToDocuments(capturedUri);
      if (appendToId) {
        appendImage(appendToId, text, permanentUri);
        router.back();
      } else {
        goToChat(text, isUpload ? 'upload' : 'camera', permanentUri);
      }
    } catch (e: any) {
      Alert.alert('OCR Failed', e?.message ?? 'Could not process the image.', [
        { text: 'Retry', onPress: () => setStage('camera') },
      ]);
    }
  };

  const handleRetry = () => {
    setCapturedUri(null);
    setStage('camera');
  };

  // ---- Permission gate ----
  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.permContainer}>
        <Ionicons name="camera-outline" size={56} color={Colors.textSecondary} />
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permSub}>
          Allow camera access to scan your handwritten notes.
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---- Adjust stage ----
  if (stage === 'adjust' && capturedUri) {
    const ratio = SCREEN_W / capturedW;
    const dispH = Math.min(capturedH * ratio, SCREEN_H * 0.75);
    return (
      <View style={styles.adjustContainer}>
        <Text style={styles.adjustHint}>Drag corners to align with the page edges</Text>
        <View style={[styles.imageContainer, { width: SCREEN_W, height: dispH }]}>
          <Image
            source={{ uri: capturedUri }}
            style={{ width: SCREEN_W, height: dispH }}
            resizeMode="cover"
          />
          <EdgeAdjustOverlay
            imageWidth={capturedW}
            imageHeight={capturedH}
            containerWidth={SCREEN_W}
            containerHeight={dispH}
            onConfirm={handleConfirmEdges}
            onRetry={handleRetry}
          />
        </View>
      </View>
    );
  }

  // ---- Camera stage ----
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back" />

      <View style={styles.overlay}>
        <View style={styles.docFrame} pointerEvents="none" />
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
          <Ionicons name="image-outline" size={26} color="#fff" />
          <Text style={styles.uploadLabel}>Upload</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shutterBtn} onPress={handleCapture}>
          <View style={styles.shutterInner} />
        </TouchableOpacity>

        <View style={{ width: 72 }} />
      </View>

      <LoadingOverlay
        visible={stage === 'processing'}
        message={mode === 'online' ? 'Extracting text with Cloud Vision…' : 'Reading text…'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docFrame: {
    width: SCREEN_W * 0.82,
    height: SCREEN_W * 0.82 * 1.41, // A4-ish ratio
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  uploadBtn: {
    alignItems: 'center',
    gap: 4,
    width: 72,
  },
  uploadLabel: {
    color: '#fff',
    fontSize: 12,
  },
  shutterBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 3,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  adjustContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  adjustHint: {
    color: '#fff',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 8,
    opacity: 0.8,
  },
  imageContainer: {
    position: 'relative',
  },
  permContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 8,
  },
  permSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  permBtn: {
    marginTop: 16,
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
