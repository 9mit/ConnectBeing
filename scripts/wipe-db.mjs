import { config } from "dotenv";
import postgres from "postgres";
import { Redis } from "@upstash/redis";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config({ path: ".env" });

async function wipeDatabase() {
  console.log("🧹 Starting full database and cache reset...\n");

  // 1. PostgreSQL public tables
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn("⚠️  DATABASE_URL is not set. Skipping Postgres table truncate.");
  } else {
    let sql;
    try {
      sql = postgres(dbUrl, { prepare: false, connect_timeout: 10 });
      console.log("📦 Connecting to PostgreSQL...");
      const tables = await sql`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename NOT LIKE '__drizzle%'
        ORDER BY tablename;
      `;

      if (tables.length === 0) {
        console.log("ℹ️  No tables found in public schema.");
      } else {
        console.log(`Found ${tables.length} tables to wipe:`, tables.map((t) => t.tablename).join(", "));
        for (const { tablename } of tables) {
          await sql`TRUNCATE TABLE ${sql(tablename)} RESTART IDENTITY CASCADE;`;
          console.log(`  ✓ Truncated ${tablename}`);
        }
        console.log("✅ All PostgreSQL tables truncated successfully.\n");
      }
    } catch (err) {
      console.error("❌ PostgreSQL error:", err.message);
      if (err.message?.includes("not found") || err.message?.includes("ENOTFOUND")) {
        const match = dbUrl.match(/postgres\.([a-zA-Z0-9]+):/);
        const ref = match ? match[1] : "your-project";
        console.warn(
          `\n⚠️  Notice: Your Supabase project appears to be paused due to inactivity.\n` +
          `   To unpause it:\n` +
          `   1. Visit https://supabase.com/dashboard/project/${ref}\n` +
          `   2. Click "Restore project"\n` +
          `   3. Once active, run 'npm run db:wipe' again.\n`
        );
      }
    } finally {
      if (sql) await sql.end();
    }
  }

  // 2. Supabase Auth Users
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    try {
      console.log("👤 Cleaning Supabase Auth users...");
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
      if (error) {
        console.warn("⚠️  Could not list Supabase Auth users:", error.message);
      } else if (data?.users && data.users.length > 0) {
        for (const u of data.users) {
          await supabase.auth.admin.deleteUser(u.id);
          console.log(`  ✓ Deleted auth user: ${u.email || u.id}`);
        }
        console.log("✅ Supabase Auth users wiped.\n");
      } else {
        console.log("ℹ️  No Supabase Auth users found.\n");
      }
    } catch (err) {
      console.warn("⚠️  Supabase Auth cleanup skipped:", err.message);
    }
  }

  // 3. Upstash Redis
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    try {
      console.log("⚡ Cleaning Upstash Redis cache & session keys...");
      const redis = new Redis({ url: redisUrl, token: redisToken });
      const keys = await redis.keys("*");
      if (keys.length > 0) {
        await Promise.all(keys.map((k) => redis.del(k)));
        console.log(`✅ Deleted ${keys.length} keys from Redis.\n`);
      } else {
        console.log("ℹ️  Redis is already empty.\n");
      }
    } catch (err) {
      console.warn("⚠️  Redis cleanup skipped:", err.message);
    }
  }

  console.log("✨ Reset process completed!");
}

wipeDatabase().catch((err) => {
  console.error("Fatal error during wipe:", err);
  process.exit(1);
});
