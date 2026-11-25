import type { QuestionItem } from '../types';

const DB_NAME = 'aprovafoco_offline_db';
const DB_VERSION = 2;
const STORE_QUESTIONS = 'questions';
const STORE_PENDING_ATTEMPTS = 'pending_attempts';

export interface PendingAttempt {
  id?: number;
  questionId: string;
  selectedOption: string;
  timeSpentSec: number;
  createdAt: string;
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (db.objectStoreNames.contains(STORE_QUESTIONS)) {
        db.deleteObjectStore(STORE_QUESTIONS);
      }
      db.createObjectStore(STORE_QUESTIONS, { keyPath: 'id' });

      if (db.objectStoreNames.contains(STORE_PENDING_ATTEMPTS)) {
        db.deleteObjectStore(STORE_PENDING_ATTEMPTS);
      }
      db.createObjectStore(STORE_PENDING_ATTEMPTS, {
        keyPath: 'id',
        autoIncrement: true,
      });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineQuestions(items: QuestionItem[]): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUESTIONS, 'readwrite');
    const store = tx.objectStore(STORE_QUESTIONS);
    for (const item of items) {
      store.put(item);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadOfflineQuestions(): Promise<QuestionItem[]> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_QUESTIONS, 'readonly');
    const store = tx.objectStore(STORE_QUESTIONS);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as QuestionItem[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function queueOfflineAttempt(
  attempt: Omit<PendingAttempt, 'id'>
): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_ATTEMPTS, 'readwrite');
    tx.objectStore(STORE_PENDING_ATTEMPTS).add(attempt);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingAttempts(): Promise<PendingAttempt[]> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_ATTEMPTS, 'readonly');
    const req = tx.objectStore(STORE_PENDING_ATTEMPTS).getAll();
    req.onsuccess = () => resolve((req.result as PendingAttempt[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function clearPendingAttempts(): Promise<void> {
  const db = await openOfflineDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING_ATTEMPTS, 'readwrite');
    tx.objectStore(STORE_PENDING_ATTEMPTS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
