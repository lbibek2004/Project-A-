import * as SQLite from 'expo-sqlite';

export type Session = {
  id: number;
  title: string;
  ocr_text: string;
  image_uris: string; // JSON-encoded string[]
  source: 'camera' | 'upload';
  created_at: number;
  updated_at: number;
};

export type Message = {
  id: number;
  session_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
};

export type QuizResult = {
  id: number;
  session_id: number;
  score: number;
  total: number;
  missed_json: string;
  created_at: number;
};

export type FlashcardResult = {
  id: number;
  session_id: number;
  score: number;
  total: number;
  missed_json: string;
  created_at: number;
};

export function openDatabase(): SQLite.SQLiteDatabase {
  return SQLite.openDatabaseSync('notes.db');
}

export function initSchema(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT    NOT NULL DEFAULT 'Untitled Session',
      ocr_text   TEXT    NOT NULL DEFAULT '',
      image_uris TEXT    NOT NULL DEFAULT '[]',
      source     TEXT    NOT NULL DEFAULT 'camera',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role       TEXT    NOT NULL,
      content    TEXT    NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_results (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      score       INTEGER NOT NULL,
      total       INTEGER NOT NULL,
      missed_json TEXT    NOT NULL DEFAULT '[]',
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flashcard_results (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      score       INTEGER NOT NULL,
      total       INTEGER NOT NULL,
      missed_json TEXT    NOT NULL DEFAULT '[]',
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_session     ON messages(session_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_session         ON quiz_results(session_id);
    CREATE INDEX IF NOT EXISTS idx_flashcard_session    ON flashcard_results(session_id);
  `);

  // Migration: add image_uris to sessions that were created before this column existed
  try {
    db.execSync(`ALTER TABLE sessions ADD COLUMN image_uris TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // Column already exists — safe to ignore
  }
}

// ---------------------------------------------------------------------------
// Session DAO
// ---------------------------------------------------------------------------

export const SessionDAO = {
  getAllSessions(db: SQLite.SQLiteDatabase): Session[] {
    return db.getAllSync<Session>(
      'SELECT * FROM sessions ORDER BY updated_at DESC'
    );
  },

  getSessionById(db: SQLite.SQLiteDatabase, id: number): Session | null {
    return db.getFirstSync<Session>('SELECT * FROM sessions WHERE id = ?', [id]) ?? null;
  },

  createSession(
    db: SQLite.SQLiteDatabase,
    title: string,
    ocrText: string,
    source: 'camera' | 'upload',
    imageUri?: string
  ): number {
    const now = Date.now();
    const imageUris = JSON.stringify(imageUri ? [imageUri] : []);
    const result = db.runSync(
      'INSERT INTO sessions (title, ocr_text, image_uris, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [title, ocrText, imageUris, source, now, now]
    );
    return result.lastInsertRowId;
  },

  appendImage(
    db: SQLite.SQLiteDatabase,
    id: number,
    extraOcrText: string,
    imageUri: string
  ): void {
    const session = db.getFirstSync<Session>('SELECT * FROM sessions WHERE id = ?', [id]);
    if (!session) return;
    const uris: string[] = JSON.parse(session.image_uris || '[]');
    uris.push(imageUri);
    const newOcrText = session.ocr_text
      ? session.ocr_text + '\n\n---\n\n' + extraOcrText
      : extraOcrText;
    db.runSync(
      'UPDATE sessions SET ocr_text = ?, image_uris = ?, updated_at = ? WHERE id = ?',
      [newOcrText, JSON.stringify(uris), Date.now(), id]
    );
  },

  updateSessionTitle(db: SQLite.SQLiteDatabase, id: number, title: string): void {
    db.runSync('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?', [
      title,
      Date.now(),
      id,
    ]);
  },

  touchSession(db: SQLite.SQLiteDatabase, id: number): void {
    db.runSync('UPDATE sessions SET updated_at = ? WHERE id = ?', [Date.now(), id]);
  },

  deleteSession(db: SQLite.SQLiteDatabase, id: number): void {
    db.runSync('DELETE FROM sessions WHERE id = ?', [id]);
  },
};

// ---------------------------------------------------------------------------
// Message DAO
// ---------------------------------------------------------------------------

export const MessageDAO = {
  getMessages(db: SQLite.SQLiteDatabase, sessionId: number): Message[] {
    return db.getAllSync<Message>(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
      [sessionId]
    );
  },

  insertMessage(
    db: SQLite.SQLiteDatabase,
    sessionId: number,
    role: 'user' | 'assistant',
    content: string
  ): number {
    const now = Date.now();
    const result = db.runSync(
      'INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)',
      [sessionId, role, content, now]
    );
    return result.lastInsertRowId;
  },
};

// ---------------------------------------------------------------------------
// Quiz Result DAO
// ---------------------------------------------------------------------------

export const QuizResultDAO = {
  saveQuizResult(
    db: SQLite.SQLiteDatabase,
    sessionId: number,
    score: number,
    total: number,
    missedJson: string
  ): void {
    db.runSync(
      'INSERT INTO quiz_results (session_id, score, total, missed_json, created_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, score, total, missedJson, Date.now()]
    );
  },

  getLatestQuizResult(db: SQLite.SQLiteDatabase, sessionId: number): QuizResult | null {
    return (
      db.getFirstSync<QuizResult>(
        'SELECT * FROM quiz_results WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
        [sessionId]
      ) ?? null
    );
  },
};

// ---------------------------------------------------------------------------
// Flashcard Result DAO
// ---------------------------------------------------------------------------

export const FlashcardResultDAO = {
  saveFlashcardResult(
    db: SQLite.SQLiteDatabase,
    sessionId: number,
    score: number,
    total: number,
    missedJson: string
  ): void {
    db.runSync(
      'INSERT INTO flashcard_results (session_id, score, total, missed_json, created_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, score, total, missedJson, Date.now()]
    );
  },

  getLatestFlashcardResult(
    db: SQLite.SQLiteDatabase,
    sessionId: number
  ): FlashcardResult | null {
    return (
      db.getFirstSync<FlashcardResult>(
        'SELECT * FROM flashcard_results WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
        [sessionId]
      ) ?? null
    );
  },
};
