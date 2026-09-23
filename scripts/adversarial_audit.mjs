import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("FATAL: DATABASE_URL missing from .env.local");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false });

async function runAdversarialAudit() {
  console.log("=== BEGINNING ADVERSARIAL & SECURITY VERIFICATION ===");
  let passed = 0;
  let failed = 0;

  function assert(name, condition) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}`);
      failed++;
    }
  }

  try {
    // 1. Database Schema Constraint Audit: Unique active couple membership
    console.log("\n--- TEST 1: Database Constraints & Single Active Couple Invariant ---");
    const indices = await sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'couple_members';
    `;
    const hasActiveUserUniqueIndex = indices.some(
      (idx) => idx.indexname === "couple_members_active_user_uidx" && idx.indexdef.includes("UNIQUE")
    );
    assert("Active couple membership is strictly unique per user in PostgreSQL schema", hasActiveUserUniqueIndex);

    // 2. RLS Functions & Security Definer Integrity
    console.log("\n--- TEST 2: PostgreSQL Row-Level Security Functions ---");
    const functions = await sql`
      SELECT proname, prosecdef 
      FROM pg_proc 
      WHERE proname IN ('madlove_app_user_id', 'madlove_user_couple_ids');
    `;
    const hasUserIdFn = functions.some((f) => f.proname === "madlove_app_user_id" && f.prosecdef === true);
    const hasCoupleIdsFn = functions.some((f) => f.proname === "madlove_user_couple_ids" && f.prosecdef === true);
    assert("RLS function madlove_app_user_id exists and is SECURITY DEFINER", hasUserIdFn);
    assert("RLS function madlove_user_couple_ids exists and is SECURITY DEFINER", hasCoupleIdsFn);

    // 3. Storage Key Partitioning & Anti-Forgery
    console.log("\n--- TEST 3: Media Storage Path Isolation ---");
    function isValidCoupleStorageKey(key, kind, coupleId) {
      if (!key || typeof key !== "string") return false;
      const expectedPrefix = `${coupleId}/${kind}/`;
      if (!key.startsWith(expectedPrefix)) return false;
      const remainder = key.slice(expectedPrefix.length);
      return !remainder.includes("..") && !remainder.startsWith("/") && remainder.length > 0;
    }

    const coupleA = "c_alpha_1111";
    const coupleB = "c_bravo_2222";
    const legitKeyA = `${coupleA}/memories/photo-1.webp`;
    const attackerKeyAtoB = `${coupleB}/memories/photo-1.webp`;
    const traversalKey = `${coupleA}/memories/../../../etc/passwd`;

    assert("Legitimate storage key for Couple A is accepted", isValidCoupleStorageKey(legitKeyA, "memories", coupleA));
    assert("Cross-tenant storage key for Couple B is rejected for Couple A", !isValidCoupleStorageKey(attackerKeyAtoB, "memories", coupleA));
    assert("Path traversal storage key is rejected", !isValidCoupleStorageKey(traversalKey, "memories", coupleA));

    // 4. Realtime Signaling Channel Scoping
    console.log("\n--- TEST 4: Realtime Channel Authorization Scoping ---");
    const COUPLE_TOPIC = /^couple:([a-zA-Z0-9_-]+):(chat|call|location|presence|moods)$/;
    const ROOM_TOPIC = /^(?:room:([a-zA-Z0-9_-]+)(?::[a-zA-Z0-9_-]+)?|room-(?:signaling|chat|presence|reactions):([a-zA-Z0-9_-]+))$/;

    function authorizeTopic(topic, userCoupleId, authorizedSessions) {
      const coupleMatch = topic.match(COUPLE_TOPIC);
      if (coupleMatch) {
        return coupleMatch[1] === userCoupleId;
      }
      const roomMatch = topic.match(ROOM_TOPIC);
      if (roomMatch) {
        const sessionId = roomMatch[1] || roomMatch[2];
        return authorizedSessions.includes(sessionId);
      }
      return false;
    }

    const coupleASessions = ["session_a1"];
    assert("Couple A can subscribe to couple:c_alpha_1111:chat", authorizeTopic("couple:c_alpha_1111:chat", coupleA, coupleASessions));
    assert("Couple A CANNOT subscribe to couple:c_bravo_2222:chat (Cross-Couple Leak Blocked)", !authorizeTopic("couple:c_bravo_2222:chat", coupleA, coupleASessions));
    assert("Couple A can subscribe to their own room signaling room-signaling:session_a1", authorizeTopic("room-signaling:session_a1", coupleA, coupleASessions));
    assert("Couple A CANNOT subscribe to Couple B room signaling room-signaling:session_b1", !authorizeTopic("room-signaling:session_b1", coupleA, coupleASessions));

    // 5. Verification Period Protection & Couple State Invariant
    console.log("\n--- TEST 5: Active Couples and Verification Table Integrity ---");
    const activeCouples = await sql`
      SELECT id, user_a_id, user_b_id, status 
      FROM couples 
      WHERE status = 'active';
    `;
    console.log(`Verified ${activeCouples.length} active couple(s) in database.`);
    for (const c of activeCouples) {
      assert(`Active couple ${c.id} has both user_a_id and user_b_id populated`, Boolean(c.user_a_id && c.user_b_id));
    }

    console.log("\n=======================================================");
    console.log(`AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log("=======================================================");
  } catch (err) {
    console.error("Adversarial test execution error:", err);
    failed++;
  } finally {
    await sql.end();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runAdversarialAudit();
