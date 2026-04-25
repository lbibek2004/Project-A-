import * as FileSystem from 'expo-file-system/legacy';

const API_KEY = process.env.EXPO_PUBLIC_CLOUD_VISION_API_KEY ?? '';
const ENDPOINT = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;
const TIMEOUT_MS = 30_000;

export async function ocrWithCloudVision(imageUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const body = {
    requests: [
      {
        image: { content: base64 },
        features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new Error('Cloud Vision timed out after 30 s. Check your internet connection and try again.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const err = await res.text();
    try {
      const parsed = JSON.parse(err);
      const msg = parsed?.error?.message ?? err;
      throw new Error(`Cloud Vision ${res.status}: ${msg}`);
    } catch {
      throw new Error(`Cloud Vision ${res.status}: ${err.slice(0, 200)}`);
    }
  }

  const data = await res.json();
  const text: string = data?.responses?.[0]?.fullTextAnnotation?.text ?? '';
  return text.trim();
}
