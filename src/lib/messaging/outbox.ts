/** IndexedDB outbox for offline / failed chat sends. */

const DB_NAME = "madlove-chat";
const STORE = "outbox";
const VERSION = 1;

export type OutboxItem = {
  clientMsgId: string;
  coupleId: string;
  content: string;
  createdAt: number;
  attempts: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clientMsgId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function outboxPut(item: OutboxItem): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function outboxDelete(clientMsgId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(clientMsgId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function outboxList(coupleId: string): Promise<OutboxItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const all = (req.result as OutboxItem[]).filter(
        (x) => x.coupleId === coupleId,
      );
      resolve(all.sort((a, b) => a.createdAt - b.createdAt));
    };
    req.onerror = () => reject(req.error);
  });
}

export function createClientMsgId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
