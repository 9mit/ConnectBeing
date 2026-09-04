const STORAGE_PREFIX = "madlove:e2ee:priv:";
const IDB_NAME = "madlove-e2ee";
const IDB_STORE = "keys";

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) {
    s += String.fromCharCode(bytes[i]!);
  }
  return btoa(s);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}

export function isE2eeCiphertext(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith("e2ee:v1:"));
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey("spki", key);
  return bufToB64(spki);
}

export async function importPublicKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "spki",
    b64ToBuf(b64),
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );
}

async function importPrivateKeyNonExtractable(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "pkcs8",
    b64ToBuf(b64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"],
  );
}

function openKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(
  userId: string,
): Promise<{ privateKey: CryptoKey; publicKey: CryptoKey } | null> {
  const db = await openKeyDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(userId);
      req.onsuccess = () => {
        const v = req.result as
          | { privateKey: CryptoKey; publicKey: CryptoKey }
          | undefined;
        resolve(v ?? null);
      };
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbPut(
  userId: string,
  pair: { privateKey: CryptoKey; publicKey: CryptoKey },
): Promise<void> {
  const db = await openKeyDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(pair, userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/**
 * Load or create ECDH keypair.
 * Private key is stored non-extractable in IndexedDB (not localStorage).
 * Device wipe = history unreadable until a backup program exists.
 */
export async function loadOrCreatePrivateKey(
  userId: string,
): Promise<CryptoKeyPair> {
  const fromIdb = await idbGet(userId);
  if (fromIdb?.privateKey && fromIdb?.publicKey) {
    return fromIdb;
  }

  // One-time migrate from legacy localStorage exportable keys
  const storageKey = `${STORAGE_PREFIX}${userId}`;
  let legacy: string | null = null;
  try {
    if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
      legacy = localStorage.getItem(storageKey);
    }
  } catch {
    // localStorage may be restricted or blocked in private browsing mode
  }
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as {
        privateKey: string;
        publicKey: string;
      };
      const privateKey = await importPrivateKeyNonExtractable(parsed.privateKey);
      const publicKey = await importPublicKey(parsed.publicKey);
      await idbPut(userId, { privateKey, publicKey });
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
      return { privateKey, publicKey };
    } catch {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* ignore */
      }
    }
  }

  const generated = await generateKeyPair();
  const privPkcs8 = await crypto.subtle.exportKey("pkcs8", generated.privateKey);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privPkcs8,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"],
  );
  const publicKey = generated.publicKey;
  await idbPut(userId, { privateKey, publicKey });
  return { privateKey, publicKey };
}

export async function deriveSharedAesKey(
  myPrivate: CryptoKey,
  partnerPublic: CryptoKey,
  coupleId: string,
): Promise<CryptoKey> {
  const bits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: partnerPublic },
    myPrivate,
    256,
  );
  const baseKey = await crypto.subtle.importKey(
    "raw",
    bits,
    "HKDF",
    false,
    ["deriveKey"],
  );
  const enc = new TextEncoder();
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: enc.encode(coupleId),
      info: enc.encode("madlove-chat-v1"),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptText(
  aesKey: CryptoKey,
  plaintext: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(plaintext),
  );
  return `e2ee:v1:${bufToB64(iv.buffer)}:${bufToB64(cipher)}`;
}

export async function decryptText(
  aesKey: CryptoKey,
  ciphertext: string,
): Promise<string> {
  if (!isE2eeCiphertext(ciphertext)) return ciphertext;
  const parts = ciphertext.split(":");
  const ivB64 = parts[2];
  const dataB64 = parts[3];
  if (!ivB64 || !dataB64) throw new Error("Invalid ciphertext");
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(b64ToBuf(ivB64)) },
    aesKey,
    b64ToBuf(dataB64),
  );
  return new TextDecoder().decode(plain);
}
