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
  getPartnerE2eePublicKeyAction,
  publishE2eePublicKeyAction,
} from "@/actions/e2ee";
import {
  confirmEphemeralUploadAction,
  createPresignedUploadAction,
  getEphemeralSignedUrlAction,
  viewEphemeralMediaAction,
} from "@/actions/media";
import {
  decryptText,
  deriveSharedAesKey,
  encryptText,
  exportPublicKey,
  isE2eeCiphertext,
  loadOrCreatePrivateKey,
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
import { Lock, Smile, Camera, Send, Phone } from "lucide-react";

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
  const [typing, setTyping] = useState(false);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [health, setHealth] = useState<ConnHealth>("reconnecting");
  const [error, setError] = useState<string | null>(null);
  const [e2eeReady, setE2eeReady] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const aesKeyRef = useRef<CryptoKey | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastSyncRef = useRef<string>(new Date().toISOString());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });

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

  const decryptMessage = useCallback(async (m: Msg) => {
    if (!m.content) return "";
    if (!isE2eeCiphertext(m.content)) return m.content;
    if (!aesKeyRef.current) return "🔒 Waiting for partner key…";
    try {
      return await decryptText(aesKeyRef.current, m.content);
    } catch {
      return "🔒 Unable to decrypt";
    }
  }, []);

  const displayCacheRef = useRef<Record<string, string>>({});

  const isTemporaryDecryptionState = (val?: string) =>
    !val || val === "🔒 Unable to decrypt" || val === "🔒 Waiting for partner key…";

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
    if (!aesKeyRef.current || !e2eeReady) return;
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

  const gapFillRef = useRef(gapFill);
  gapFillRef.current = gapFill;
  const flushOutboxRef = useRef(flushOutbox);
  flushOutboxRef.current = flushOutbox;

  useEffect(() => {
    void (async () => {
      try {
        const pair = await loadOrCreatePrivateKey(userId);
        const pub = await exportPublicKey(pair.publicKey);
        await publishE2eePublicKeyAction({ publicKey: pub });
        const partner = await getPartnerE2eePublicKeyAction();
        if (partner.ok && partner.data.publicKey) {
          const { importPublicKey } = await import("@/lib/crypto/e2ee");
          const partnerKey = await importPublicKey(partner.data.publicKey);
          aesKeyRef.current = await deriveSharedAesKey(
            pair.privateKey,
            partnerKey,
            coupleId,
          );
          setE2eeReady(true);
        }
      } catch {
        setE2eeReady(false);
      }
      await load();
      await flushOutbox();
    })();
  }, [userId, coupleId, load, flushOutbox]);

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
          void decryptMessage(msg).then((t) =>
            setDisplay((d) => ({ ...d, [msg.id]: t })),
          );
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
              m.id === String(row.id)
                ? {
                    ...m,
                    read: Boolean(row.read),
                    deliveredAt: (row.delivered_at as string | null) ?? m.deliveredAt,
                    deliveryStatus: String(
                      row.delivery_status ?? m.deliveryStatus,
                    ),
                  }
                : m,
            ),
          );
        },
      )
      .on("broadcast", { event: "typing:start" }, ({ payload }: { payload: any }) => {
        if (payload.userId !== userId) setTyping(true);
      })
      .on("broadcast", { event: "typing:stop" }, ({ payload }: { payload: any }) => {
        if (payload.userId !== userId) setTyping(false);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const others = Object.keys(state).filter((k) => k !== userId);
        setPartnerOnline(others.length > 0);
      });

    channel.subscribe(async (status: string) => {
      if (disposed) return;
      if (status === "SUBSCRIBED") {
        setHealth("connected");
        await channel.track({ userId, at: Date.now() });
        await gapFillRef.current();
        await flushOutboxRef.current();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setHealth("reconnecting");
      } else if (status === "CLOSED") {
        setHealth("offline");
      }
    });

    const onOnline = () => {
      setHealth("reconnecting");
      void gapFillRef.current().then(() => flushOutboxRef.current());
    };
    const onOffline = () => setHealth("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [coupleId, userId, decryptMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing]);

  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el || !cursor) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && cursor) {
          void load(cursor);
        }
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, load]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

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
    if (!body || !aesKeyRef.current || !e2eeReady) return;
    const clientMsgId = createClientMsgId();
    startTransition(async () => {
      try {
        const cipher = await encryptText(aesKeyRef.current!, body);
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
    const mimeType = file.type as "image/jpeg" | "image/png" | "image/webp";
    const presign = await createPresignedUploadAction({
      kind: "ephemeral",
      mimeType,
    });
    if (!presign.ok) {
      setError(presign.error.message);
      return;
    }
    const upload = await fetch(presign.data.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mimeType },
      body: file,
    });
    if (!upload.ok) {
      setError("Upload failed");
      return;
    }
    const confirm = await confirmEphemeralUploadAction({
      storageKey: presign.data.storageKey,
      mimeType,
    });
    if (!confirm.ok) setError(confirm.error.message);
  }

  async function viewEphemeral(mediaId: string) {
    const signed = await getEphemeralSignedUrlAction(mediaId);
    if (!signed.ok) {
      setError(signed.error.message);
      return;
    }
    window.open(signed.data.url, "_blank", "noopener,noreferrer");
    await viewEphemeralMediaAction({ mediaId });
  }

  return (
    <div className="flex h-[calc(100dvh-10.5rem)] md:h-[75vh] flex-col rounded-2xl border border-white/[0.08] bg-[#0c0d12] overflow-hidden shadow-2xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0f1017]/80 backdrop-blur-md px-5 py-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Lock className="w-3.5 h-3.5 text-amber-300/80" />
            <span className="text-[11px] font-medium tracking-wide">
              {e2eeReady ? "End-to-End Encrypted" : "Exchanging Encryption Keys…"}
            </span>
          </div>
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

          <Link
            href="/call"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:text-white hover:border-white/20 transition-colors"
          >
            <Phone className="w-3 h-3 text-amber-300/80" />
            <span className="hidden sm:inline">Voice Call</span>
          </Link>
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 space-y-3.5 overflow-y-auto p-4 sm:p-6 scrollbar-none">
        <div ref={topSentinelRef} />
        {cursor ? (
          <div className="text-center text-[10px] text-zinc-500 font-medium">
            Scroll up for older messages
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-2 py-16">
            <div className="w-10 h-10 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center mb-1">
              <Lock className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-[#f7f6f2]">Your private conversation</p>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
              Every message and photo is encrypted directly between your two devices.
            </p>
          </div>
        ) : null}

        {messages.map((m) => {
          const isMe = m.senderId === userId;
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
                {m.type === "ephemeral_image" && m.ephemeralMediaId ? (
                  <button
                    type="button"
                    className="flex items-center gap-2 font-medium text-amber-200 hover:text-white transition-colors py-1 text-xs"
                    onClick={() => void viewEphemeral(m.ephemeralMediaId!)}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>View Once Photo</span>
                  </button>
                ) : (
                  <span
                    className={
                      isEmojiHeavyMessage(
                        display[m.id] ??
                          display[m.clientMsgId ?? ""] ??
                          "",
                      )
                        ? "text-3xl leading-snug tracking-wide"
                        : "whitespace-pre-wrap break-words leading-relaxed"
                    }
                  >
                    {display[m.id] ?? display[m.clientMsgId ?? ""] ?? m.content}
                  </span>
                )}
              </div>

              {isMe && m.type === "text" && (
                <div className="text-[10px] text-zinc-400 self-end font-mono flex items-center gap-1">
                  {statusTicks(m, userId)}
                </div>
              )}
            </div>
          );
        })}

        {typing ? (
          <p className="text-xs text-zinc-400 italic pl-1 flex items-center gap-1.5 animate-pulse">
            <span>Partner is typing…</span>
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="px-5 py-2 text-xs font-medium text-rose-300 bg-rose-950/40 border-t border-rose-500/20">
          {error}
        </p>
      ) : null}

      {/* Modern Input Dock */}
      <div className="relative flex items-center gap-2 border-t border-white/[0.06] bg-[#0c0d12] p-3 sm:p-4">
        <EmojiPicker
          open={emojiOpen}
          onClose={() => setEmojiOpen(false)}
          onPick={insertEmoji}
        />

        <button
          type="button"
          onClick={() => {
            rememberCaret();
            setEmojiOpen((v) => !v);
          }}
          className={`p-2.5 rounded-xl border transition-all ${
            emojiOpen
              ? "text-amber-200 bg-white/[0.08] border-white/20"
              : "text-zinc-400 hover:text-zinc-200 border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
          }`}
          aria-label="Open emoji picker"
          aria-expanded={emojiOpen}
        >
          <Smile className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05] transition-all"
          aria-label="Send view-once photo"
          title="Send view-once photo"
        >
          <Camera className="w-4 h-4" />
        </button>

        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void sendEphemeral(file);
          }}
        />

        <input
          ref={textInputRef}
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
    </div>
  );
}
