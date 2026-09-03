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

  const refreshDisplay = useCallback(
    async (rows: Msg[]) => {
      const entries = await Promise.all(
        rows.map(async (m) => [m.id, await decryptMessage(m)] as const),
      );
      setDisplay((d) => ({ ...d, ...Object.fromEntries(entries) }));
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
        await gapFill();
        await flushOutbox();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setHealth("reconnecting");
      } else if (status === "CLOSED") {
        setHealth("offline");
      }
    });

    const onOnline = () => {
      setHealth("reconnecting");
      void gapFill().then(() => flushOutbox());
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
  }, [coupleId, userId, decryptMessage, gapFill, flushOutbox]);

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
    <div className="flex h-[calc(100dvh-12rem)] md:h-[75vh] flex-col rounded-3xl glass-panel border border-amber-500/20 bg-purple-950/40 overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.12)]">
      <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 bg-purple-950/60 px-6 py-3.5 text-xs font-semibold tracking-wider uppercase text-amber-300/80">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              e2eeReady ? "bg-amber-400 animate-pulse shadow-[0_0_8px_#fbbf24]" : "bg-amber-600"
            }`}
          />
          <span className="text-amber-200">
            {e2eeReady
              ? "End-to-end encryption active"
              : "Encryption pending partner key exchange"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] normal-case tracking-normal">
          <span
            className={
              partnerOnline ? "text-amber-400 font-semibold" : "text-slate-500"
            }
          >
            {partnerOnline ? "Partner online" : "Partner offline"}
          </span>
          <span
            className={
              health === "connected"
                ? "text-amber-300"
                : health === "reconnecting"
                  ? "text-amber-500"
                  : "text-red-400"
            }
          >
            {health}
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-6 scrollbar-thin">
        <div ref={topSentinelRef} />
        {cursor ? (
          <div className="text-center text-[10px] text-amber-400/60">
            Scroll up for older messages
          </div>
        ) : null}

        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 py-20">
            <p className="text-sm font-semibold text-amber-300">Your shared chat has begun.</p>
            <p className="text-xs text-slate-400">
              Messages are E2EE and never readable by anyone else.
            </p>
          </div>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.clientMsgId ?? m.id}
            className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm flex flex-col space-y-1.5 ${
              m.senderId === userId
                ? "ml-auto bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-purple-950 font-medium rounded-tr-none shadow-[0_0_15px_rgba(212,175,55,0.3)]"
                : "bg-purple-900/60 border border-amber-500/20 text-slate-100 rounded-tl-none shadow-md"
            } ${m.failed ? "opacity-70 ring-1 ring-red-400/40" : ""} ${
              m.optimistic ? "opacity-80" : ""
            }`}
          >
            <div>
              {m.type === "ephemeral_image" && m.ephemeralMediaId ? (
                <button
                  type="button"
                  className="flex items-center gap-2 font-semibold text-amber-300 hover:text-amber-100 transition-colors py-0.5 underline"
                  onClick={() => void viewEphemeral(m.ephemeralMediaId!)}
                >
                  Tap to view once
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
                      : "whitespace-pre-wrap break-words"
                  }
                >
                  {display[m.id] ?? display[m.clientMsgId ?? ""] ?? m.content}
                </span>
              )}
            </div>
            {m.senderId === userId && m.type === "text" ? (
              <div className="text-[9px] font-bold tracking-wider uppercase opacity-70 self-end text-purple-950">
                {statusTicks(m, userId)}
              </div>
            ) : null}
          </div>
        ))}
        {typing ? (
          <p className="text-xs text-amber-300/70 italic pl-1.5">
            Partner is typing…
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {error ? (
        <p className="px-6 py-2 text-xs font-semibold text-red-300 bg-red-950/70 border-t border-red-500/30">
          {error}
        </p>
      ) : null}

      <div className="relative flex items-center gap-2 border-t border-amber-500/20 bg-purple-950/60 p-4">
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
          className={`p-3 rounded-xl border border-amber-500/30 bg-purple-900/40 transition-all ${
            emojiOpen
              ? "text-amber-300 bg-amber-500/20 border-amber-400"
              : "text-slate-300 hover:text-amber-300 hover:bg-purple-900/60"
          }`}
          aria-label="Open emoji picker"
          aria-expanded={emojiOpen}
        >
          😊
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-3 rounded-xl border border-amber-500/30 bg-purple-900/40 text-slate-300 hover:text-amber-300 hover:bg-purple-900/60 transition-all"
          aria-label="Send view-once photo"
        >
          📷
        </button>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
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
          placeholder="Type a secure message..."
          aria-label="Secure message"
          className="flex-1 rounded-xl border border-amber-500/30 bg-purple-950/40 px-4 py-3 text-base text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 focus:bg-purple-900/60 transition-all"
        />
        <button
          type="button"
          disabled={pending || !e2eeReady}
          onClick={() => {
            setEmojiOpen(false);
            send();
          }}
          aria-label="Send encrypted message"
          className="rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 px-5 py-3 text-sm font-extrabold text-purple-950 hover:from-amber-300 hover:to-amber-500 disabled:opacity-60 transition-all shadow-[0_0_15px_rgba(212,175,55,0.3)]"
        >
          Send
        </button>
      </div>
    </div>
  );
}
