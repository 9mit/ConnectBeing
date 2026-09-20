import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import postgres from "postgres";

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing.");
  }

  const sql = postgres(connectionString, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
  });

  console.log("Applying WatchSession column migrations to database...");

  try {
    await sql`
      ALTER TABLE watch_sessions 
      ADD COLUMN IF NOT EXISTS host_user_id text REFERENCES users(id) ON DELETE SET NULL;
    `;
    console.log("✓ Added host_user_id column");

    await sql`
      ALTER TABLE watch_sessions 
      ADD COLUMN IF NOT EXISTS host_stream_active boolean DEFAULT false;
    `;
    console.log("✓ Added host_stream_active column");

    await sql`
      ALTER TABLE watch_sessions 
      ADD COLUMN IF NOT EXISTS host_stream_type text DEFAULT 'none';
    `;
    console.log("✓ Added host_stream_type column");

    await sql`
      ALTER TABLE watch_sessions 
      ADD COLUMN IF NOT EXISTS playback_state text DEFAULT 'idle';
    `;
    console.log("✓ Added playback_state column");

    await sql`
      ALTER TABLE watch_sessions 
      ADD COLUMN IF NOT EXISTS current_position integer DEFAULT 0;
    `;
    console.log("✓ Added current_position column");

    await sql`
      ALTER TABLE watch_sessions 
      ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();
    `;
    console.log("✓ Added updated_at column");

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

void migrate();
