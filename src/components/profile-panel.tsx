"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Heart, Calendar, Edit2, Save, X } from "lucide-react";

import {
  getCoupleProfilesAction,
  updateAnniversaryAction,
  updateProfileAction,
  type CoupleProfileDataDTO,
} from "@/actions/profile";
import { formatDateLong } from "@/lib/date";

export function ProfilePanel({
  initialData,
}: {
  initialData?: CoupleProfileDataDTO | null;
} = {}) {
  const [data, setData] = useState<CoupleProfileDataDTO | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit Mode state
  const [editingProfile, setEditingProfile] = useState(false);
  const [name, setName] = useState(initialData?.me?.name ?? "");
  const [selfDesc, setSelfDesc] = useState(initialData?.me?.selfDescription ?? "");
  const [partnerExpect, setPartnerExpect] = useState(initialData?.me?.partnerExpectation ?? "");
  const [hobbiesStr, setHobbiesStr] = useState(initialData?.me?.hobbies ? initialData.me.hobbies.join(", ") : "");
  const [loveLangStr, setLoveLangStr] = useState(initialData?.me?.loveLanguages ? initialData.me.loveLanguages.join(", ") : "");
  const [avatarUrl, setAvatarUrl] = useState(initialData?.me?.avatarUrl ?? "");

  // Edit Anniversary
  const [editingAnniversary, setEditingAnniversary] = useState(false);
  const [anniversaryInput, setAnniversaryInput] = useState(
    initialData?.anniversaryDate ? new Date(initialData.anniversaryDate).toISOString().slice(0, 10) : ""
  );

  const [pending, startTransition] = useTransition();

  async function loadData() {
    const res = await getCoupleProfilesAction();
    if (res.ok) {
      setData(res.data);
      setName(res.data.me.name);
      setSelfDesc(res.data.me.selfDescription);
      setPartnerExpect(res.data.me.partnerExpectation);
      setHobbiesStr(res.data.me.hobbies.join(", "));
      setLoveLangStr(res.data.me.loveLanguages.join(", "));
      setAvatarUrl(res.data.me.avatarUrl || "");
      if (res.data.anniversaryDate) {
        setAnniversaryInput(new Date(res.data.anniversaryDate).toISOString().slice(0, 10));
      }
      setError(null);
    } else {
      setError(res.error.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!initialData) {
      void loadData();
    }
  }, [initialData]);

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setError(null);
      const res = await updateProfileAction({
        name,
        selfDescription: selfDesc,
        partnerExpectation: partnerExpect,
        hobbies: hobbiesStr.split(",").map((s) => s.trim()).filter(Boolean),
        loveLanguages: loveLangStr.split(",").map((s) => s.trim()).filter(Boolean),
        avatarUrl: avatarUrl || undefined,
      });

      if (res.ok) {
        setEditingProfile(false);
        setSuccess("Profile updated successfully!");
        setTimeout(() => setSuccess(null), 3000);
        await loadData();
      } else {
        setError(res.error.message);
      }
    });
  }

  function handleSaveAnniversary(e: React.FormEvent) {
    e.preventDefault();
    if (!anniversaryInput) return;

    startTransition(async () => {
      setError(null);
      const res = await updateAnniversaryAction({
        anniversaryDate: new Date(anniversaryInput).toISOString(),
      });

      if (res.ok) {
        setEditingAnniversary(false);
        setSuccess("Anniversary date saved!");
        setTimeout(() => setSuccess(null), 3000);
        await loadData();
      } else {
        setError(res.error.message);
      }
    });
  }

  if (loading) {
    return <p className="text-sm text-amber-300/70 italic py-12 text-center">Loading couple profiles…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-300 text-center">{error || "Failed to load profiles"}</p>;
  }

  const { me, partner } = data;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Couple Relationship Banner */}
      <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_0_35px_rgba(212,175,55,0.12)]">
        <div className="space-y-1 text-center md:text-left">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-400 flex items-center justify-center md:justify-start gap-1.5">
            <Heart className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>Bound in Love</span>
          </span>
          <h1 className="text-3xl font-extrabold text-white font-display mt-1 text-glow-gold">
            {me.name} & {partner?.name || "Partner"}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Together for <strong className="text-amber-300 font-bold">{data.daysTogetherLabel}</strong> ({data.daysTogether} days)
          </p>
        </div>

        {/* Anniversary Control */}
        <div className="bg-purple-950/80 border border-amber-500/30 px-5 py-3.5 rounded-2xl flex items-center gap-4 shadow-inner">
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block">
              Anniversary Date
            </span>
            <span className="text-sm font-bold text-amber-200">
              {data.anniversaryDate
                ? formatDateLong(data.anniversaryDate)
                : "Not set yet"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setEditingAnniversary(!editingAnniversary)}
            className="text-xs text-amber-300 hover:text-white p-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Edit Anniversary Form Modal */}
      {editingAnniversary && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSaveAnniversary}
          className="rounded-2xl glass-panel p-5 border border-amber-500/40 bg-purple-950/70 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-xs font-bold text-white">Select Relationship Anniversary Date</p>
              <input
                type="date"
                required
                value={anniversaryInput}
                onChange={(e) => setAnniversaryInput(e.target.value)}
                className="mt-1 rounded-xl border border-amber-500/30 bg-purple-950/60 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditingAnniversary(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="btn-madlove-gold px-4 py-1.5 text-xs font-bold"
            >
              {pending ? "Saving…" : "Save Date"}
            </button>
          </div>
        </motion.form>
      )}

      {error && (
        <p className="text-sm font-semibold text-red-300 bg-red-950/70 border border-red-500/30 px-4 py-2 rounded-xl text-center">
          {error}
        </p>
      )}

      {success && (
        <p className="text-sm font-semibold text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-4 py-2 rounded-xl text-center">
          {success}
        </p>
      )}

      {/* Side-by-Side Profiles */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* My Profile */}
        <div className="rounded-3xl glass-panel border border-amber-500/30 bg-purple-950/50 p-6 md:p-8 space-y-5 shadow-lg relative">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-purple-600 p-0.5 shadow-[0_0_15px_rgba(212,175,55,0.3)]">
                <div className="w-full h-full rounded-full bg-purple-950 flex items-center justify-center text-lg font-bold text-amber-200">
                  {me.name.slice(0, 1).toUpperCase()}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                  Your Profile
                </span>
                <h2 className="text-xl font-bold text-white font-display text-glow-gold">
                  {me.name}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditingProfile(!editingProfile)}
              className="text-xs font-bold text-amber-300 hover:text-white px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center gap-1.5"
            >
              {editingProfile ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
              <span>{editingProfile ? "Cancel" : "Edit"}</span>
            </button>
          </div>

          {editingProfile ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Display Name / Nickname
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Self Description / Bio
                </label>
                <textarea
                  rows={2}
                  value={selfDesc}
                  onChange={(e) => setSelfDesc(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Love Languages (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="quality time, physical touch, words of affirmation"
                  value={loveLangStr}
                  onChange={(e) => setLoveLangStr(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Hobbies (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="cooking, cinema, stargazing"
                  value={hobbiesStr}
                  onChange={(e) => setHobbiesStr(e.target.value)}
                  className="w-full rounded-xl border border-amber-500/30 bg-purple-950/40 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-madlove-gold px-5 py-2 text-xs font-bold flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{pending ? "Saving…" : "Save Profile"}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs">
              <div>
                <span className="font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                  Bio & Spirit
                </span>
                <p className="text-slate-200 leading-relaxed font-medium bg-purple-950/40 p-3 rounded-xl border border-white/5">
                  {me.selfDescription || "No bio added yet."}
                </p>
              </div>

              <div>
                <span className="font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                  Love Languages
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {me.loveLanguages.length > 0 ? (
                    me.loveLanguages.map((l) => (
                      <span
                        key={l}
                        className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 font-semibold"
                      >
                        {l}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">Not specified</span>
                  )}
                </div>
              </div>

              <div>
                <span className="font-bold text-amber-300/80 uppercase tracking-wider block mb-1">
                  Passions & Hobbies
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {me.hobbies.length > 0 ? (
                    me.hobbies.map((h) => (
                      <span
                        key={h}
                        className="px-2.5 py-1 rounded-full bg-purple-900/40 border border-purple-800/40 text-slate-200"
                      >
                        {h}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">Not specified</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Partner Profile */}
        <div className="rounded-3xl glass-panel border border-purple-800/40 bg-purple-950/50 p-6 md:p-8 space-y-5 shadow-lg">
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-0.5 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                <div className="w-full h-full rounded-full bg-purple-950 flex items-center justify-center text-lg font-bold text-purple-200">
                  {(partner?.name || "P").slice(0, 1).toUpperCase()}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-purple-300">
                  Partner Profile
                </span>
                <h2 className="text-xl font-bold text-white font-display">
                  {partner?.name || "Partner"}
                </h2>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-purple-900/50 text-purple-200 border border-purple-700/40">
              Synced
            </span>
          </div>

          {partner ? (
            <div className="space-y-4 text-xs">
              <div>
                <span className="font-bold text-purple-300/80 uppercase tracking-wider block mb-1">
                  Bio & Spirit
                </span>
                <p className="text-slate-200 leading-relaxed font-medium bg-purple-950/40 p-3 rounded-xl border border-white/5">
                  {partner.selfDescription || "Partner hasn't written a bio yet."}
                </p>
              </div>

              <div>
                <span className="font-bold text-purple-300/80 uppercase tracking-wider block mb-1">
                  Love Languages
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {partner.loveLanguages.length > 0 ? (
                    partner.loveLanguages.map((l) => (
                      <span
                        key={l}
                        className="px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-200 font-semibold"
                      >
                        {l}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">Not specified</span>
                  )}
                </div>
              </div>

              <div>
                <span className="font-bold text-purple-300/80 uppercase tracking-wider block mb-1">
                  Passions & Hobbies
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {partner.hobbies.length > 0 ? (
                    partner.hobbies.map((h) => (
                      <span
                        key={h}
                        className="px-2.5 py-1 rounded-full bg-purple-900/40 border border-purple-800/40 text-slate-200"
                      >
                        {h}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">Not specified</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400">
              <p className="text-sm">Partner is not yet connected.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
