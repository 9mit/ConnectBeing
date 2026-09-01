# ConnectBeing

Couples sanctuary platform on Next.js 14 + Supabase + Postgres (Drizzle) + Upstash Redis + WebRTC.

A cinematic, privacy-first private space built exclusively for two.

## Features & Highlights

- **🔒 Zero-Knowledge End-to-End Encryption**: Direct messages encrypted with ECDH P-256 and AES-GCM-256.
- **🍿 Virtual Theater (Together)**: Synchronized 4K streaming rooms, shared reactions, and drift-corrected playback.
- **📍 Real-Time Presence & Distance**: Privacy-preserving distance sync and one-tap emotional vibes.
- **📸 Memory Vault & Time Capsules**: Chronological photo timeline and date-locked digital love letters.
- **✨ Relationship Intelligence Engine (RIE)**: On-device synergy analytics, daily quizzes, and archetype tracking.
- **🐹 Digital Spirit Companion**: Shared companion that thrives as you check in and build rituals together.

## Quick Start & Scripts

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Run TypeScript static typechecker
npm run typecheck

# Run ESLint quality checks
npm run lint

# Build production bundle
npm run build

# Run database migrations
npm run db:migrate
```

## Security & Architecture Notes

- **Zero-Knowledge Chat**: Server stores only `e2ee:v1:` ciphertexts.
- **Cryptographic Keys**: ECDH P-256 keys generated and stored in client-side non-extractable IndexedDB.
- **Weekly Couple Gate**: Rotating Base32 codes hashed with SHA-256 in PostgreSQL.
- **Deterministic RIE**: Relationship insights calculated locally with zero external LLM training on private conversations.
