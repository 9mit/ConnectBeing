"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import {
  ackDeliveredAction,
  getMessagesAction,
  markMessagesReadAction,
  sendMessageAction,
  syncMessagesSinceAction,
  type ChatMessageDTO,
} from "@/actions/chat";
import {
  DeviceInfoDTO,
  getCoupleActiveDevicesAction,
  getPartnerE2eePublicKeyAction,
  publishE2eePublicKeyAction,
  registerDeviceAction,
  revokeDeviceAction,
  saveKeyEscrowAction,
  getKeyEscrowAction,
} from "@/actions/e2ee";
import {
  confirmEphemeralUploadAction,
  createPresignedUploadAction,
  getEphemeralSignedUrlAction,
  viewEphemeralMediaAction,
} from "@/actions/media";
import {
  computeSafetyNumber,
  createKeyBackupPackage,
  decryptAttachment,
  decryptMultiDeviceMessage,
  decryptText,
  deriveSharedAesKey,
  DeviceKeyRecord,
  E2EE_V1_PREFIX,
  E2EE_V2_PREFIX,
  encryptAttachment,
  EncryptedMediaDescriptor,
  encryptMultiDeviceMessage,
  encryptText,
  exportPublicKey,
  getOrCreateDeviceId,
  isE2eeCiphertext,
  loadOrCreatePrivateKey,
  restoreKeyBackupPackage,
} from "@/lib/crypto/e2ee";
import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";
import {
  createClientMsgId,
  outboxDelete,
  outboxList,
  outboxPut,
} from "@/lib/messaging/outbox";
import { isEmojiHeavyMessage } from "@/lib/chat/emoji-data";
import { createClient } from "@/lib/supabase/client";
import { EmojiPicker } from "@/components/emoji-picker";
import Link from "next/link";
import {
  Lock,
  Smile,
  Camera,
  Send,
  Phone,
  Search,
  Shield,
  Key,
  RefreshCw,
  X,
  Smartphone,
  Laptop,
  CheckCircle,
} from "lucide-react";

type Msg = ChatMessageDTO & { optimistic?: boolean; failed?: boolean };

type ConnHealth = "connected" | "reconnecting" | "offline";

function mergeMessages(prev: Msg[], incoming: Msg[]): Msg[] {
  const map = new Map<string, Msg>();
  for (const m of prev) {
    const key = m.clientMsgId ? `c:${m.clientMsgId}` : m.id;
    map.set(key, m);
  }
  for (const m of incoming) {
    const key = m.clientMsgId ? `c:${m.clientMsgId}` : m.id;
    const existing = map.get(key);
    if (existing?.optimistic) {
      map.set(key, { ...m, optimistic: false, failed: false });
    } else {
      map.set(key, { ...existing, ...m, optimistic: false });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function statusTicks(m: Msg, userId: string): string {
  if (m.senderId !== userId || m.type !== "text") return "";
  if (m.failed) return "Failed";
  if (m.optimistic) return "Sending…";
  if (m.read || m.deliveryStatus === "read") return "✓✓ Read";
  if (m.deliveredAt || m.deliveryStatus === "delivered") return "✓✓ Delivered";
  return "✓ Sent";
}

export function ChatPanel({
  coupleId,
  userId,
}: {
  coupleId: string;
  userId: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [display, setDisplay] = useState<Record<string, string>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [typing, setTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [health, setHealth] = useState<ConnHealth>("reconnecting");
  const [error, setError] = useState<string | null>(null);
  const [e2eeReady, setE2eeReady] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [safetyNumber, setSafetyNumber] = useState<string | null>(null);
  const [myDevices, setMyDevices] = useState<DeviceInfoDTO[]>([]);
  const [partnerDevices, setPartnerDevices] = useState<DeviceInfoDTO[]>([]);
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState("");
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const aesKeyRef = useRef<CryptoKey | null>(null);
  const myKeysRef = useRef<CryptoKeyPair | null>(null);
  const myDeviceIdRef = useRef<string>("");
  const myPublicKeySpkiRef = useRef<string>("");
  const activeDevicesRef = useRef<DeviceKeyRecord[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSyncRef = useRef<string>(new Date().toISOString());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const displayCacheRef = useRef<Record<string, string>>({});

  const rememberCaret = () => {
    const el = textInputRef.current;
    if (!el) return;
    caretRef.current = {
      start: el.selectionStart ?? el.value.length,
      end: el.selectionEnd ?? el.value.length,
    };
  };

  const insertEmoji = (emoji: string) => {
    const { start, end } = caretRef.current;
    const next = text.slice(0, start) + emoji + text.slice(end);
    const caret = start + emoji.length;
    setText(next);
    caretRef.current = { start: caret, end: caret };
    requestAnimationFrame(() => {
      const el = textInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const decryptMessage = useCallback(
    async (m: Msg): Promise<string> => {
      if (!m.content) return "";
      if (!isE2eeCiphertext(m.content)) return m.content;

      // 1. Try e2ee:v2: multi-device envelope
      if (m.content.startsWith(E2EE_V2_PREFIX) && myKeysRef.current) {
        try {
          return await decryptMultiDeviceMessage({
            ciphertext: m.content,
            myDeviceId: myDeviceIdRef.current,
            myPrivateKey: myKeysRef.current.privateKey,
            coupleId,
          });
        } catch {
          // If not wrapped for this specific device
          return "🔒 Encrypted for another device";
        }
      }

      // 2. Try e2ee:v1: legacy pairwise AES key
      if (m.content.startsWith(E2EE_V1_PREFIX) && aesKeyRef.current) {
        try {
          return await decryptText(aesKeyRef.current, m.content);
        } catch {
          return "🔒 Unable to decrypt";
        }
      }

      return "🔒 Waiting for keys…";
    },
    [coupleId],
  );

  const isTemporaryDecryptionState = (val?: string) =>
    !val ||
    val === "🔒 Unable to decrypt" ||
    val === "🔒 Waiting for keys…" ||
    val === "🔒 Waiting for partner key…";

  const refreshDisplay = useCallback(
    async (rows: Msg[]) => {
      const toDecrypt = rows.filter((m) => {
        const cached = displayCacheRef.current[m.id];
        return isTemporaryDecryptionState(cached);
      });
      if (toDecrypt.length === 0) return;

      const entries = await Promise.all(
        toDecrypt.map(async (m) => [m.id, await decryptMessage(m)] as const),
      );
      const newEntries = Object.fromEntries(entries);
      Object.assign(displayCacheRef.current, newEntries);
      setDisplay((d) => ({ ...d, ...newEntries }));
    },
    [decryptMessage],
  );

  const load = useCallback(
    async (nextCursor?: string) => {
      const result = await getMessagesAction({
        cursor: nextCursor,
        limit: 50,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMessages((prev) => {
        const mapped = result.data.messages.map((m) => ({ ...m }));
        return mergeMessages(
          nextCursor ? prev : [],
          nextCursor
            ? [...mapped.reverse(), ...prev]
            : mapped.reverse(),
        );
      });
      setCursor(result.data.nextCursor);
      await refreshDisplay(result.data.messages);
      await markMessagesReadAction();
      if (result.data.messages[0]) {
        const newest = result.data.messages.reduce((a, b) =>
          a.createdAt > b.createdAt ? a : b,
        );
        if (newest.createdAt > lastSyncRef.current) {
          lastSyncRef.current = newest.createdAt;
        }
      }
    },
    [refreshDisplay],
  );

  const flushOutbox = useCallback(async () => {
    if (!e2eeReady) return;
    const items = await outboxList(coupleId);
    for (const item of items) {
      const res = await sendMessageAction({
        content: item.content,
        clientMsgId: item.clientMsgId,
      });
      if (res.ok) {
        await outboxDelete(item.clientMsgId);
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMsgId === item.clientMsgId
              ? {
                  ...m,
                  id: res.data.id,
                  optimistic: false,
                  failed: false,
                  deliveryStatus: "sent",
                }
              : m,
          ),
        );
      } else if (item.attempts >= 5) {
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMsgId === item.clientMsgId
              ? { ...m, failed: true, optimistic: false }
              : m,
          ),
        );
      } else {
        await outboxPut({ ...item, attempts: item.attempts + 1 });
      }
    }
  }, [coupleId, e2eeReady]);

  const gapFill = useCallback(async () => {
    let since = lastSyncRef.current;
    let guard = 0;
    const collected: Msg[] = [];
    while (guard < 20) {
      guard += 1;
      const res = await syncMessagesSinceAction({ since, limit: 100 });
      if (!res.ok) break;
      collected.push(...res.data.messages);
      if (!res.data.hasMore || !res.data.nextSince) {
        if (res.data.nextSince) since = res.data.nextSince;
        break;
      }
      since = res.data.nextSince;
    }
    if (collected.length) {
      setMessages((prev) => mergeMessages(prev, collected));
      await refreshDisplay(collected);
      const incoming = collected.filter((m) => m.senderId !== userId);
      if (incoming.length) {
        await ackDeliveredAction(incoming.map((m) => m.id));
        void markMessagesReadAction();
      }
      const newest = collected.reduce((a, b) =>
        a.createdAt > b.createdAt ? a : b,
      );
      lastSyncRef.current = newest.createdAt;
    }
  }, [refreshDisplay, userId]);

  const refreshDeviceState = useCallback(async () => {
    const coupleDevs = await getCoupleActiveDevicesAction();
    if (coupleDevs.ok) {
      setMyDevices(coupleDevs.data.myDevices);
      setPartnerDevices(coupleDevs.data.partnerDevices);

      const allActive: DeviceKeyRecord[] = [
        ...coupleDevs.data.partnerDevices.map((d) => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          publicKeySpki: d.publicKeySpki,
        })),
        ...coupleDevs.data.myDevices
          .filter((d) => d.deviceId !== myDeviceIdRef.current)
          .map((d) => ({
            deviceId: d.deviceId,
            deviceName: d.deviceName,
            publicKeySpki: d.publicKeySpki,
          })),
      ];
      activeDevicesRef.current = allActive;

      const mySpkis = coupleDevs.data.myDevices.map((d) => d.publicKeySpki);
      const partnerSpkis = coupleDevs.data.partnerDevices.map((d) => d.publicKeySpki);
      if (mySpkis.length && partnerSpkis.length) {
        const sn = await computeSafetyNumber(mySpkis, partnerSpkis);
        setSafetyNumber(sn);
      }
    }
  }, []);

  // Initialize E2EE & Multi-Device Enrollment
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const deviceId = getOrCreateDeviceId();
        myDeviceIdRef.current = deviceId;

        const pair = await loadOrCreatePrivateKey(userId);
        if (!active) return;
        myKeysRef.current = pair;

        const pub = await exportPublicKey(pair.publicKey);
        myPublicKeySpkiRef.current = pub;

        // Register active device
        const deviceName =
          typeof navigator !== "undefined" && navigator.userAgent.includes("Mobile")
            ? "Mobile Device"
            : "Desktop Browser";

        await registerDeviceAction({
          deviceId,
          deviceName,
          publicKey: pub,
        });

        // Publish legacy key for backwards compatibility
        await publishE2eePublicKeyAction({ publicKey: pub });

        // Query partner key and active devices
        const partner = await getPartnerE2eePublicKeyAction();
        if (partner.ok && partner.data.publicKey) {
          const { importPublicKey } = await import("@/lib/crypto/e2ee");
          const partnerKey = await importPublicKey(partner.data.publicKey);
          aesKeyRef.current = await deriveSharedAesKey(
            pair.privateKey,
            partnerKey,
            coupleId,
          );
        }

        await refreshDeviceState();
        if (active) setE2eeReady(true);
      } catch (err) {
        console.error("[ChatPanel] E2EE initialization error:", err);
        if (active) setE2eeReady(false);
      }

      await load();
      await flushOutbox();
    })();

    return () => {
      active = false;
    };
  }, [userId, coupleId, load, flushOutbox, refreshDeviceState]);

  useEffect(() => {
    if (e2eeReady) {
      for (const key of Object.keys(displayCacheRef.current)) {
        if (isTemporaryDecryptionState(displayCacheRef.current[key])) {
          delete displayCacheRef.current[key];
        }
      }
    }
    void refreshDisplay(messages);
  }, [e2eeReady, messages, refreshDisplay]);

  // Realtime channel setup
  useEffect(() => {
    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      setHealth("offline");
      return;
    }

    const topic = `couple:${coupleId}:chat`;
    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed || !auth.ok) {
        setHealth("offline");
        return;
      }
    });

    const channel = supabase.channel(topic, {
      config: { presence: { key: userId } },
    });
    channelRef.current = channel;

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload: any) => {
          const row = payload.new as Record<string, unknown>;
          const msg: Msg = {
            id: String(row.id),
            senderId: String(row.sender_id),
            content: (row.content as string | null) ?? null,
            type: String(row.type),
            ephemeralMediaId: (row.ephemeral_media_id as string | null) ?? null,
            createdAt: String(row.created_at),
            read: Boolean(row.read),
            deliveredAt: (row.delivered_at as string | null) ?? null,
            deliveryStatus: String(row.delivery_status ?? "sent"),
            clientMsgId: (row.client_msg_id as string | null) ?? null,
          };
          setMessages((prev) => mergeMessages(prev, [msg]));
          void refreshDisplay([msg]);
          if (msg.senderId !== userId) {
            void ackDeliveredAction([msg.id]);
            void markMessagesReadAction();
          }
          if (msg.createdAt > lastSyncRef.current) {
            lastSyncRef.current = msg.createdAt;
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload: any) => {
          const row = payload.new as Record<string, unknown>;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    read: Boolean(row.read),
                    deliveredAt: (row.delivered_at as string | null) ?? null,
                    deliveryStatus: String(row.delivery_status ?? m.deliveryStatus),
                  }
                : m,
            ),
          );
        },
      )
      .on("broadcast", { event: "typing:start" }, ({ payload }: { payload: any }) => {
        if (payload?.userId && payload.userId !== userId) setTyping(true);
      })
      .on("broadcast", { event: "typing:stop" }, ({ payload }: { payload: any }) => {
        if (payload?.userId && payload.userId !== userId) setTyping(false);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const otherPresent = Object.keys(state).some((k) => k !== userId);
        setPartnerOnline(otherPresent);
      })
      .subscribe((status: string) => {
        if (disposed) return;
        if (status === "SUBSCRIBED") {
          setHealth("connected");
          void channel.track({ onlineAt: new Date().toISOString() });
          void gapFill();
          void flushOutbox();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setHealth("reconnecting");
        } else if (status === "CLOSED") {
          setHealth("offline");
        }
      });

    return () => {
      disposed = true;
      void channel.unsubscribe();
    };
  }, [coupleId, userId, gapFill, flushOutbox, refreshDisplay]);

  // Scroll to bottom on message updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const emitTyping = () => {
    void channelRef.current?.send({
      type: "broadcast",
      event: "typing:start",
      payload: { userId },
    });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      void channelRef.current?.send({
        type: "broadcast",
        event: "typing:stop",
        payload: { userId },
      });
    }, 2000);
  };

  const send = () => {
    const body = text.trim();
    if (!body || !e2eeReady) return;
    const clientMsgId = createClientMsgId();

    startTransition(async () => {
      try {
        let cipher: string;
        // Prioritize multi-device envelope encryption
        if (myKeysRef.current && activeDevicesRef.current.length > 0) {
          cipher = await encryptMultiDeviceMessage({
            plaintext: body,
            coupleId,
            senderId: userId,
            messageId: clientMsgId,
            myDeviceId: myDeviceIdRef.current,
            myPrivateKey: myKeysRef.current.privateKey,
            myPublicKeySpki: myPublicKeySpkiRef.current,
            recipientDevices: activeDevicesRef.current,
          });
        } else if (aesKeyRef.current) {
          // Pairwise fallback
          cipher = await encryptText(aesKeyRef.current, body);
        } else {
          throw new Error("Encryption keys not established yet.");
        }

        const optimistic: Msg = {
          id: clientMsgId,
          senderId: userId,
          content: cipher,
          type: "text",
          ephemeralMediaId: null,
          createdAt: new Date().toISOString(),
          read: false,
          deliveredAt: null,
          deliveryStatus: "pending",
          clientMsgId,
          optimistic: true,
        };

        setMessages((prev) => mergeMessages(prev, [optimistic]));
        setDisplay((d) => ({ ...d, [clientMsgId]: body }));
        setText("");

        await outboxPut({
          clientMsgId,
          coupleId,
          content: cipher,
          createdAt: Date.now(),
          attempts: 0,
        });

        const res = await sendMessageAction({ content: cipher, clientMsgId });
        if (!res.ok) {
          setError(res.error.message);
          setMessages((prev) =>
            prev.map((m) =>
              m.clientMsgId === clientMsgId
                ? { ...m, failed: true, optimistic: false }
                : m,
            ),
          );
          return;
        }

        await outboxDelete(clientMsgId);
        setMessages((prev) =>
          prev.map((m) =>
            m.clientMsgId === clientMsgId
              ? {
                  ...m,
                  id: res.data.id,
                  optimistic: false,
                  deliveryStatus: "sent",
                }
              : m,
          ),
        );
        setDisplay((d) => {
          const next = { ...d, [res.data.id]: body };
          delete next[clientMsgId];
          return next;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Send failed");
      }
    });
  };

  async function sendEphemeral(file: File) {
    try {
      const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
      const fileBytes = await file.arrayBuffer();

      // 1. Encrypt image client-side before upload (Zero-Knowledge)
      const { encryptedBlob, descriptor } = await encryptAttachment(
        fileBytes,
        mimeType,
        file.name,
      );

      // 2. Request presigned upload for encrypted binary blob
      const presign = await createPresignedUploadAction({
        kind: "ephemeral",
        mimeType: "application/octet-stream",
      });
      if (!presign.ok) {
        setError(presign.error.message);
        return;
      }

      // 3. Upload pure ciphertext to Supabase Storage
      const upload = await fetch(presign.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: encryptedBlob,
      });
      if (!upload.ok) {
        setError("Upload failed");
        return;
      }

      // 4. Confirm upload on server
      const confirm = await confirmEphemeralUploadAction({
        storageKey: presign.data.storageKey,
        mimeType: "application/octet-stream",
        encrypted: true,
      });
      if (!confirm.ok) {
        setError(confirm.error.message);
        return;
      }

      // 5. Send E2EE descriptor message containing decryption key
      descriptor.storageKey = presign.data.storageKey;
      const mediaPayload = JSON.stringify({
        type: "ephemeral_media_descriptor",
        mediaId: confirm.data.mediaId,
        descriptor,
      });

      const clientMsgId = createClientMsgId();
      let cipher: string;
      if (myKeysRef.current && activeDevicesRef.current.length > 0) {
        cipher = await encryptMultiDeviceMessage({
          plaintext: mediaPayload,
          coupleId,
          senderId: userId,
          messageId: clientMsgId,
          myDeviceId: myDeviceIdRef.current,
          myPrivateKey: myKeysRef.current.privateKey,
          myPublicKeySpki: myPublicKeySpkiRef.current,
          recipientDevices: activeDevicesRef.current,
        });
      } else if (aesKeyRef.current) {
        cipher = await encryptText(aesKeyRef.current, mediaPayload);
      } else {
        throw new Error("Encryption keys not ready");
      }

      await sendMessageAction({ content: cipher, clientMsgId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send photo");
    }
  }

  async function viewEphemeral(
    mediaId: string,
    directDescriptor?: EncryptedMediaDescriptor,
  ) {
    try {
      const signed = await getEphemeralSignedUrlAction(mediaId);
      if (!signed.ok) {
        setError(signed.error.message);
        return;
      }

      if (directDescriptor) {
        // Download ciphertext and decrypt in browser memory
        const res = await fetch(signed.data.url);
        const encryptedBytes = await res.arrayBuffer();
        const decryptedBlob = await decryptAttachment(encryptedBytes, directDescriptor);
        const objectUrl = URL.createObjectURL(decryptedBlob);
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      } else {
        window.open(signed.data.url, "_blank", "noopener,noreferrer");
      }
      await viewEphemeralMediaAction({ mediaId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open photo");
    }
  }

  const handleRevokeDevice = async (deviceIdToRevoke: string) => {
    const res = await revokeDeviceAction({ deviceId: deviceIdToRevoke });
    if (res.ok) {
      await refreshDeviceState();
    } else {
      setError(res.error.message);
    }
  };

  const handleCreateBackup = async () => {
    if (!myKeysRef.current || !backupPassphrase) return;
    try {
      setBackupStatus("Creating backup…");
      const pkg = await createKeyBackupPackage(
        myKeysRef.current.privateKey,
        backupPassphrase,
      );
      const pkgStr = JSON.stringify(pkg);
      const res = await saveKeyEscrowAction({
        deviceId: myDeviceIdRef.current,
        encryptedKeyPackage: pkgStr,
      });
      if (res.ok) {
        setBackupStatus("✓ Key backup safely stored in encrypted escrow.");
        setBackupPassphrase("");
      } else {
        setBackupStatus(`Backup failed: ${res.error.message}`);
      }
    } catch (err: any) {
      setBackupStatus(`Error: ${err.message}`);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restorePassphrase) return;
    try {
      setRestoreStatus("Restoring key…");
      const escrow = await getKeyEscrowAction(myDeviceIdRef.current);
      if (!escrow.ok || !escrow.data.encryptedKeyPackage) {
        setRestoreStatus("No escrow record found for this device.");
        return;
      }
      const pkg = JSON.parse(escrow.data.encryptedKeyPackage);
      const restoredPair = await restoreKeyBackupPackage(pkg, restorePassphrase);
      myKeysRef.current = restoredPair;
      setRestoreStatus("✓ Private key restored successfully!");
      setRestorePassphrase("");
      await refreshDeviceState();
      void refreshDisplay(messages);
    } catch (err: any) {
      setRestoreStatus(`Restore error: ${err.message}`);
    }
  };

  // Filter messages for local search
  const filteredMessages = isSearching && searchQuery.trim()
    ? messages.filter((m) => {
        const textDecrypted = display[m.id] ?? "";
        return textDecrypted.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : messages;

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] md:h-[75vh] flex-col rounded-2xl border border-white/[0.08] bg-[#0c0d12] overflow-hidden shadow-2xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0f1017]/80 backdrop-blur-md px-5 py-3 text-xs">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowSecurityModal(true)}
            className="flex items-center gap-1.5 text-zinc-300 hover:text-white transition-colors cursor-pointer group"
            title="Click to view Safety Number and trusted devices"
          >
            <Lock className="w-3.5 h-3.5 text-amber-300/80 group-hover:text-amber-300 transition-colors" />
            <span className="text-[11px] font-medium tracking-wide underline decoration-dotted decoration-zinc-600 underline-offset-2">
              {e2eeReady ? "End-to-End Encrypted" : "Exchanging Encryption Keys…"}
            </span>
          </button>
          <span className="text-zinc-600">·</span>
          <div className="flex items-center gap-1.5 text-[11px]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                partnerOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-zinc-600"
              }`}
            />
            <span className={partnerOnline ? "text-[#f7f6f2] font-medium" : "text-zinc-500"}>
              {partnerOnline ? "Partner active" : "Partner away"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {health !== "connected" && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                health === "reconnecting"
                  ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                  : "bg-red-500/10 text-red-300 border border-red-500/20"
              }`}
            >
              {health}
            </span>
          )}

          {/* Local Search Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsSearching(!isSearching);
              if (isSearching) setSearchQuery("");
            }}
            className={`p-1.5 rounded-lg border transition-colors ${
              isSearching
                ? "bg-amber-400/10 text-amber-300 border-amber-400/30"
                : "bg-white/[0.02] text-zinc-400 hover:text-white border-white/[0.08]"
            }`}
            title="Search decrypted messages locally"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <Link
            href="/call"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:text-white hover:border-white/20 transition-colors"
          >
            <Phone className="w-3 h-3 text-amber-300/80" />
            <span className="hidden sm:inline">Voice Call</span>
          </Link>
        </div>
      </div>

      {/* Local Search Input (Client-Side Only) */}
      {isSearching && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-[#12131b] border-b border-white/[0.06]">
          <Search className="w-3.5 h-3.5 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search within decrypted messages on this device…"
            className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              Clear
            </button>
          )}
          <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded">
            Local Only
          </span>
        </div>
      )}

      {/* Message Stream */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-6 scrollbar-none">
        <div ref={topSentinelRef} />
        {cursor ? (
          <div className="text-center text-[10px] text-zinc-500 font-medium">
            Scroll up for older messages
          </div>
        ) : null}

        {filteredMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-2 py-16">
            <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-1">
              <Lock className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-[#f7f6f2]">
              {isSearching ? "No matching messages found locally" : "Your private conversation"}
            </p>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
              {isSearching
                ? "Search queries never leave this device."
                : "Every message and photo is encrypted directly between your trusted devices."}
            </p>
          </div>
        ) : null}

        {filteredMessages.map((m) => {
          const isMe = m.senderId === userId;
          const displayBody = display[m.id] ?? display[m.clientMsgId ?? ""] ?? "🔒 Encrypted";

          // Parse ephemeral media descriptor if present in decrypted payload
          let mediaDescriptor: EncryptedMediaDescriptor | null = null;
          try {
            if (displayBody.startsWith("{") && displayBody.includes("ephemeral_media_descriptor")) {
              const parsedDesc = JSON.parse(displayBody);
              if (parsedDesc.type === "ephemeral_media_descriptor") {
                mediaDescriptor = parsedDesc.descriptor;
              }
            }
          } catch {
            /* not JSON */
          }

          return (
            <div
              key={m.clientMsgId ?? m.id}
              className={`max-w-[78%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm flex flex-col space-y-1 ${
                isMe
                  ? "ml-auto bg-[#222533] border border-white/[0.08] text-[#f7f6f2] rounded-tr-xs"
                  : "bg-[#12131a] border border-white/[0.06] text-zinc-200 rounded-tl-xs"
              } ${m.failed ? "opacity-70 ring-1 ring-rose-500/40" : ""} ${
                m.optimistic ? "opacity-75" : ""
              }`}
            >
              <div>
                {m.type === "ephemeral_image" || mediaDescriptor ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 font-medium text-amber-200 hover:text-white transition-colors py-1 text-xs"
                    onClick={() =>
                      void viewEphemeral(
                        m.ephemeralMediaId ?? mediaDescriptor?.storageKey ?? m.id,
                        mediaDescriptor ?? undefined,
                      )
                    }
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>View Once Photo (E2EE)</span>
                  </button>
                ) : (
                  <span
                    className={
                      isEmojiHeavyMessage(displayBody)
                        ? "text-2xl leading-relaxed"
                        : "break-words leading-relaxed"
                    }
                  >
                    {displayBody}
                  </span>
                )}
              </div>

              <div
                className={`flex items-center gap-1.5 text-[10px] ${
                  isMe ? "text-zinc-400 justify-end" : "text-zinc-500 justify-start"
                }`}
              >
                <span>
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {statusTicks(m, userId) ? (
                  <span>· {statusTicks(m, userId)}</span>
                ) : null}
              </div>
            </div>
          );
        })}

        {typing ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400 pl-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Partner is typing…</span>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {error ? (
        <div className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-red-950/40 border border-red-800/40 px-3 py-1.5 text-xs text-red-300">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Input Bar */}
      <div className="border-t border-white/[0.06] bg-[#0f1017]/90 backdrop-blur-md p-3 sm:p-4 flex items-center gap-2 relative">
        {emojiOpen ? (
          <div className="absolute bottom-full left-3 mb-2 z-50">
            <EmojiPicker
              open={emojiOpen}
              onPick={insertEmoji}
              onClose={() => setEmojiOpen(false)}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setEmojiOpen(!emojiOpen)}
          aria-label="Pick emoji"
          className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5 text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <Smile className="w-4 h-4" />
        </button>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void sendEphemeral(file);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Send view once photo"
          title="Send view-once photo (Encrypted client-side)"
          className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-2.5 text-zinc-400 hover:text-amber-200 hover:bg-white/[0.05] transition-colors"
        >
          <Camera className="w-4 h-4" />
        </button>

        <input
          ref={textInputRef}
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            caretRef.current = {
              start: e.target.selectionStart ?? e.target.value.length,
              end: e.target.selectionEnd ?? e.target.value.length,
            };
            emitTyping();
          }}
          onSelect={rememberCaret}
          onClick={rememberCaret}
          onKeyUp={rememberCaret}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setEmojiOpen(false);
              send();
            }
          }}
          placeholder="Message your partner privately…"
          aria-label="Private message"
          className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 sm:px-4 py-2.5 text-base sm:text-sm text-[#f7f6f2] placeholder-zinc-500 focus:outline-none focus:border-white/20 focus:bg-white/[0.05] transition-all"
        />

        <button
          type="button"
          disabled={pending || !e2eeReady || !text.trim()}
          onClick={() => {
            setEmojiOpen(false);
            send();
          }}
          aria-label="Send message"
          className="rounded-xl bg-[#f7f6f2] text-[#07080b] p-2.5 text-sm font-semibold hover:bg-white disabled:opacity-35 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Security Verification & Multi-Device Modal */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.12] bg-[#0f1017] p-6 text-zinc-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-4">
              <div className="flex items-center gap-2 text-[#f7f6f2]">
                <Shield className="w-5 h-5 text-amber-300" />
                <h3 className="text-base font-semibold">End-to-End Encryption Security</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSecurityModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Safety Number */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                  Safety Number (Fingerprint)
                </span>
                <span className="text-[11px] text-zinc-400">P-256 ECDH / SHA-256</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Compare this number in person or over an independent channel to verify that neither the server nor an active adversary has intercepted your keys.
              </p>
              <div className="rounded-xl border border-white/[0.08] bg-black/40 p-3.5 font-mono text-center text-sm font-medium tracking-widest text-[#f7f6f2] break-all select-all">
                {safetyNumber || "Calculating Safety Number…"}
              </div>
            </div>

            {/* Enrolled Devices */}
            <div className="space-y-3 mb-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                Authorized Partner Devices
              </span>
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-zinc-400">Your Devices:</div>
                {myDevices.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-zinc-400" />
                      <div>
                        <div className="font-medium text-[#f7f6f2]">
                          {d.deviceName}{" "}
                          {d.deviceId === myDeviceIdRef.current && (
                            <span className="text-[10px] text-amber-300 font-normal">
                              (This Device)
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {d.deviceId.slice(0, 16)}…
                        </div>
                      </div>
                    </div>
                    {d.deviceId !== myDeviceIdRef.current && (
                      <button
                        type="button"
                        onClick={() => void handleRevokeDevice(d.deviceId)}
                        className="text-[11px] text-red-400 hover:text-red-300"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}

                <div className="text-[11px] font-medium text-zinc-400 mt-3">
                  Partner Devices:
                </div>
                {partnerDevices.length === 0 ? (
                  <div className="text-xs text-zinc-500 italic">No partner devices enrolled yet.</div>
                ) : (
                  partnerDevices.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Laptop className="w-4 h-4 text-emerald-400" />
                        <div>
                          <div className="font-medium text-[#f7f6f2]">{d.deviceName}</div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {d.deviceId.slice(0, 16)}…
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> Active
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Zero-Knowledge Backup & Restore */}
            <div className="space-y-3 border-t border-white/[0.08] pt-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200">
                <Key className="w-3.5 h-3.5" />
                <span>Zero-Knowledge Key Backup (Client Encrypted)</span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Derive an offline recovery package using PBKDF2 (100,000 rounds of SHA-256). The server never sees this passphrase or your private keys.
              </p>

              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={backupPassphrase}
                  onChange={(e) => setBackupPassphrase(e.target.value)}
                  placeholder="Recovery passphrase (min 8 chars)"
                  className="flex-1 rounded-lg border border-white/[0.08] bg-black/30 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateBackup()}
                  disabled={!backupPassphrase || backupPassphrase.length < 8}
                  className="rounded-lg bg-amber-300 text-black px-3 py-1.5 text-xs font-semibold disabled:opacity-40 hover:bg-amber-200 transition-colors"
                >
                  Backup Key
                </button>
              </div>
              {backupStatus && (
                <div className="text-[11px] text-amber-200">{backupStatus}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
