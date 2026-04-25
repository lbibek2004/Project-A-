import { Platform } from 'react-native';

// Physical devices need the host machine's LAN IP — localhost only works on emulators
const LAN_IP = '192.168.X.X'; // TODO: replace with your machine's Wi-Fi IP (run `ipconfig`)
const BASE_URL = `http://${LAN_IP}:5000`;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Server error ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// POST /process — upload image, get OCR text
// ---------------------------------------------------------------------------

export type ProcessResult = {
  text: string;
  word_count: number;
  strategy: string;
  crop_worked: boolean;
};

export async function processImage(imageUri: string): Promise<ProcessResult> {
  const formData = new FormData();
  const filename = imageUri.split('/').pop() ?? 'image.jpg';
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    webp: 'image/webp',
  };
  formData.append('image', {
    uri: imageUri,
    name: filename,
    type: mimeMap[ext] ?? 'image/jpeg',
  } as unknown as Blob);

  const res = await fetch(`${BASE_URL}/process`, { method: 'POST', body: formData });
  return handleResponse<ProcessResult>(res);
}

// ---------------------------------------------------------------------------
// POST /ask — question answering over notes
// ---------------------------------------------------------------------------

export async function askQuestion(
  noteText: string,
  question: string,
  fullAi: boolean = false
): Promise<{ answer: string }> {
  const res = await fetch(`${BASE_URL}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: noteText, question, full_ai: fullAi }),
  });
  return handleResponse<{ answer: string }>(res);
}

// ---------------------------------------------------------------------------
// POST /generate-quiz — generate quiz questions from notes
// ---------------------------------------------------------------------------

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
};

export async function generateQuiz(
  text: string,
  count: number
): Promise<{ questions: QuizQuestion[] }> {
  const res = await fetch(`${BASE_URL}/generate-quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, count }),
  });
  return handleResponse<{ questions: QuizQuestion[] }>(res);
}

// ---------------------------------------------------------------------------
// POST /generate-flashcards — generate flashcard pairs from notes
// ---------------------------------------------------------------------------

export type FlashCard = {
  front: string;
  back: string;
};

export async function generateFlashcards(
  text: string,
  count: number
): Promise<{ cards: FlashCard[] }> {
  const res = await fetch(`${BASE_URL}/generate-flashcards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, count }),
  });
  return handleResponse<{ cards: FlashCard[] }>(res);
}
