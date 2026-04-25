import React, { createContext, useContext, useEffect, useRef } from 'react';
import * as SQLite from 'expo-sqlite';
import { openDatabase, initSchema } from '../lib/database';

type DatabaseContextValue = {
  db: SQLite.SQLiteDatabase;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);

  if (dbRef.current === null) {
    dbRef.current = openDatabase();
    initSchema(dbRef.current);
  }

  return (
    <DatabaseContext.Provider value={{ db: dbRef.current }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): SQLite.SQLiteDatabase {
  const ctx = useContext(DatabaseContext);
  if (!ctx) throw new Error('useDatabase must be used inside DatabaseProvider');
  return ctx.db;
}
