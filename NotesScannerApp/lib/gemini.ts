import { QuizQuestion, FlashCard } from './llm';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent';

async function generate(systemInstruction: string, userPrompt: string): Promise<string> {
  const res = await fetch(`${BASE}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1);
  return raw.trim();
}

export async function geminiAsk(
  noteText: string,
  question: string,
  fullAi: boolean
): Promise<string> {
  const system = fullAi
    ? 'You are a helpful AI assistant. Use the provided notes as context, but you may also draw on general knowledge.'
    : 'You are a study assistant. Answer ONLY from the provided notes. If the answer is not in the notes, say "I could not find that in the notes."';

  const prompt = `Notes:\n---\n${noteText}\n---\n\nQuestion: ${question}`;
  const answer = await generate(system, prompt);
  return answer.trim();
}

export async function geminiGenerateQuiz(
  noteText: string,
  count: number
): Promise<QuizQuestion[]> {
  const system =
    'You are a quiz generator. Return ONLY a valid JSON array — no markdown, no explanation. Each element: {"question":string,"options":["A. ...","B. ...","C. ...","D. ..."],"answer":string matching one option exactly}.';
  const prompt = `Create exactly ${count} multiple-choice questions from these notes:\n---\n${noteText}\n---\nJSON:`;

  const raw = await generate(system, prompt);
  try {
    const parsed = JSON.parse(extractJson(raw));
    if (Array.isArray(parsed)) return parsed as QuizQuestion[];
  } catch {}
  return [];
}

export async function geminiGenerateFlashcards(
  noteText: string,
  count: number
): Promise<FlashCard[]> {
  const system =
    'You are a flashcard generator. Return ONLY a valid JSON array — no markdown, no explanation. Each element: {"front":string,"back":string}.';
  const prompt = `Create exactly ${count} flashcards from these notes:\n---\n${noteText}\n---\nJSON:`;

  const raw = await generate(system, prompt);
  try {
    const parsed = JSON.parse(extractJson(raw));
    if (Array.isArray(parsed)) return parsed as FlashCard[];
  } catch {}
  return [];
}
