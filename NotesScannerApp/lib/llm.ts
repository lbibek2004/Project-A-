export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };
type GenerateFn = (messages: ChatMessage[]) => Promise<string>;

export async function askQuestion(
  noteText: string,
  question: string,
  fullAi: boolean,
  generate: GenerateFn
): Promise<string> {
  const systemContent = fullAi
    ? 'You are a helpful AI assistant. Use the provided notes as context, but you may also draw on general knowledge.'
    : 'You are a study assistant. Answer ONLY from the provided notes. If the answer is not in the notes, say "I could not find that in the notes."';

  const answer = await generate([
    { role: 'system', content: systemContent },
    { role: 'user', content: `Notes:\n---\n${noteText}\n---\n\nQuestion: ${question}` },
  ]);
  return answer.trim();
}

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: string;
};

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1);
  return raw.trim();
}

export async function generateQuiz(
  noteText: string,
  count: number,
  generate: GenerateFn
): Promise<QuizQuestion[]> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a quiz generator. Return ONLY a valid JSON array — no markdown, no explanation. Each element: {"question":string,"options":["A. ...","B. ...","C. ...","D. ..."],"answer":string matching one option exactly}.',
    },
    {
      role: 'user',
      content: `Create exactly ${count} multiple-choice questions from these notes:\n---\n${noteText}\n---\nJSON:`,
    },
  ];

  const raw = await generate(messages);
  try {
    const parsed = JSON.parse(extractJson(raw));
    if (Array.isArray(parsed)) return parsed as QuizQuestion[];
  } catch {}
  return [];
}

export type FlashCard = {
  front: string;
  back: string;
};

export async function generateFlashcards(
  noteText: string,
  count: number,
  generate: GenerateFn
): Promise<FlashCard[]> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a flashcard generator. Return ONLY a valid JSON array — no markdown, no explanation. Each element: {"front":string,"back":string}.',
    },
    {
      role: 'user',
      content: `Create exactly ${count} flashcards from these notes:\n---\n${noteText}\n---\nJSON:`,
    },
  ];

  const raw = await generate(messages);
  try {
    const parsed = JSON.parse(extractJson(raw));
    if (Array.isArray(parsed)) return parsed as FlashCard[];
  } catch {}
  return [];
}
