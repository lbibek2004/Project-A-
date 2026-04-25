import React, { createContext, useContext, useState, useCallback } from 'react';
import { Session, Message, SessionDAO, MessageDAO } from '../lib/database';
import { useDatabase } from './DatabaseContext';

type SessionContextValue = {
  sessions: Session[];
  loadSessions: () => void;
  createSession: (ocrText: string, source: 'camera' | 'upload', imageUri?: string) => number;
  appendImage: (sessionId: number, additionalOcrText: string, imageUri: string) => void;
  deleteSession: (id: number) => void;
  currentSession: Session | null;
  setCurrentSession: (s: Session | null) => void;
  refreshCurrentSession: (id: number) => void;
  messages: Message[];
  loadMessages: (sessionId: number) => void;
  addMessage: (sessionId: number, role: 'user' | 'assistant', content: string) => Message;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const db = useDatabase();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  const loadSessions = useCallback(() => {
    setSessions(SessionDAO.getAllSessions(db));
  }, [db]);

  const createSession = useCallback(
    (ocrText: string, source: 'camera' | 'upload', imageUri?: string): number => {
      const preview = ocrText.slice(0, 40).replace(/\n/g, ' ').trim();
      const title = preview.length > 0 ? preview : 'Untitled Session';
      const id = SessionDAO.createSession(db, title, ocrText, source, imageUri);
      setSessions(SessionDAO.getAllSessions(db));
      return id;
    },
    [db]
  );

  const appendImage = useCallback(
    (sessionId: number, additionalOcrText: string, imageUri: string) => {
      SessionDAO.appendImage(db, sessionId, additionalOcrText, imageUri);
      setSessions(SessionDAO.getAllSessions(db));
    },
    [db]
  );

  const deleteSession = useCallback(
    (id: number) => {
      SessionDAO.deleteSession(db, id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    },
    [db]
  );

  const refreshCurrentSession = useCallback(
    (id: number) => {
      const s = SessionDAO.getSessionById(db, id);
      setCurrentSession(s);
    },
    [db]
  );

  const loadMessages = useCallback(
    (sessionId: number) => {
      setMessages(MessageDAO.getMessages(db, sessionId));
    },
    [db]
  );

  const addMessage = useCallback(
    (sessionId: number, role: 'user' | 'assistant', content: string): Message => {
      const id = MessageDAO.insertMessage(db, sessionId, role, content);
      SessionDAO.touchSession(db, sessionId);
      const msg: Message = { id, session_id: sessionId, role, content, created_at: Date.now() };
      setMessages((prev) => [...prev, msg]);
      return msg;
    },
    [db]
  );

  return (
    <SessionContext.Provider
      value={{
        sessions,
        loadSessions,
        createSession,
        appendImage,
        deleteSession,
        currentSession,
        setCurrentSession,
        refreshCurrentSession,
        messages,
        loadMessages,
        addMessage,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
