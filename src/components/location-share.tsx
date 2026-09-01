"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Navigation, Compass, Heart, ShieldCheck } from "lucide-react";

import { recordLocationMinutesAction } from "@/actions/realtime";
import { authorizeRealtimeTopicAction } from "@/actions/realtime-auth";
import { createClient } from "@/lib/supabase/client";

const MapView = dynamic(() => import("@/components/location-map"), { ssr: false });

function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function LocationShare({
  coupleId,
  userId,
}: {
  coupleId: string;
  userId: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [partnerPos, setPartnerPos] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const uptimeRef = useRef(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    let disposed = false;
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch {
      return;
    }

    const topic = `couple:${coupleId}:location`;
    const channel = supabase.channel(topic, {
      config: { private: true },
    });
    channelRef.current = channel;

    void authorizeRealtimeTopicAction(topic).then((auth) => {
      if (disposed || !auth.ok) return;
      channel
        .on("broadcast", { event: "location" }, ({ payload }) => {
          if (payload.userId !== userId) {
            setPartnerPos({ lat: payload.lat, lng: payload.lng });
          }
        })
        .on("broadcast", { event: "location:off" }, ({ payload }) => {
          if (payload.userId !== userId) setPartnerPos(null);
        })
        .subscribe();
    });

    return () => {
      disposed = true;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [coupleId, userId]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMyPos({ lat, lng });
        void channelRef.current?.send({
          type: "broadcast",
          event: "location",
          payload: { userId, lat, lng, timestamp: Date.now() },
        });
      });
      uptimeRef.current += 0.5;
      if (uptimeRef.current >= 1) {
        const mins = Math.floor(uptimeRef.current);
        uptimeRef.current -= mins;
        void recordLocationMinutesAction({ minutes: mins });
      }
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      clearInterval(id);
      void channelRef.current?.send({
        type: "broadcast",
        event: "location:off",
        payload: { userId },
      });
    };
  }, [enabled, userId]);

  const distanceKm =
    myPos && partnerPos
      ? calculateDistanceKm(myPos.lat, myPos.lng, partnerPos.lat, partnerPos.lng)
      : null;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>Privacy-Preserved Distance Sync</span>
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            Live Distance & Presence
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
            See the distance separating you and your partner in real time, with end-to-end privacy.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          className={`px-6 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg ${
            enabled
              ? "bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500 hover:text-white"
              : "btn-madlove-gold"
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>{enabled ? "Stop Sharing" : "Share Live Location"}</span>
        </button>
      </div>

      {/* Distance Metric Card */}
      {distanceKm !== null ? (
        <div className="rounded-2xl glass-panel border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-purple-950/40 to-pink-500/10 p-6 text-center shadow-lg">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
            Distance Between Souls
          </span>
          <div className="text-4xl font-extrabold text-white font-display mt-1 text-glow-gold flex items-center justify-center gap-2">
            <Heart className="w-6 h-6 text-rose-400 fill-rose-400" />
            <span>{distanceKm === 0 ? "Together in the same room" : `${distanceKm} km apart`}</span>
          </div>
          <p className="text-xs text-slate-300 mt-2">
            No matter the distance, you build your universe together.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl glass-panel p-4 border border-amber-500/15 bg-purple-950/30 text-xs text-slate-300 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {enabled
                ? "Waiting for partner to enable location sharing…"
                : "Enable sharing to see live distance between you and your partner."}
            </span>
          </div>
        </div>
      )}

      {/* Map View */}
      <div className="rounded-3xl overflow-hidden border border-amber-500/30 shadow-2xl">
        <MapView myPos={myPos} partnerPos={partnerPos} />
      </div>
    </div>
  );
}
