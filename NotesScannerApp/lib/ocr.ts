import TextRecognition from '@react-native-ml-kit/text-recognition';

export async function recognizeFromCamera(imageUri: string): Promise<string> {
  const result = await TextRecognition.recognize(imageUri);
  return result.text.trim();
}

export async function recognizeFromUpload(imageUri: string): Promise<string> {
  return recognizeFromCamera(imageUri);
}
