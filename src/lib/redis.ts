import { Redis } from "@upstash/redis";

import { isProductionRuntime } from "@/lib/runtime";

class MockRedis {
  private store = new Map<string, unknown>();
  private expiries = new Map<string, number>();

  private isExpired(key: string): boolean {
    const exp = this.expiries.get(key);
    if (exp && Date.now() > exp) {
      this.store.delete(key);
      this.expiries.delete(key);
      return true;
    }
    return false;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    if (this.isExpired(key)) return null;
    return (this.store.get(key) as T) ?? null;
  }

  async set(key: string, value: unknown, options?: { ex?: number; nx?: boolean }) {
    if (options?.nx && this.store.has(key) && !this.isExpired(key)) {
      return null;
    }
    this.store.set(key, value);
    if (options?.ex) {
      this.expiries.set(key, Date.now() + options.ex * 1000);
    } else {
      this.expiries.delete(key);
    }
    return "OK";
  }

  async del(...keys: string[]) {
    let count = 0;
    for (const k of keys) {
      if (this.store.delete(k)) count++;
      this.expiries.delete(k);
    }
    return count;
  }

  async incr(key: string) {
    if (this.isExpired(key)) this.store.delete(key);
    const val = (this.store.get(key) as number) || 0;
    const next = val + 1;
    this.store.set(key, next);
    return next;
  }

  async incrby(key: string, value: number) {
    if (this.isExpired(key)) this.store.delete(key);
    const val = (this.store.get(key) as number) || 0;
    const next = val + value;
    this.store.set(key, next);
    return next;
  }

  async expire(key: string, seconds: number) {
    if (!this.store.has(key) || this.isExpired(key)) return 0;
    this.expiries.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async ttl(key: string) {
    if (!this.store.has(key) || this.isExpired(key)) return -2;
    const exp = this.expiries.get(key);
    if (!exp) return -1;
    return Math.max(0, Math.floor((exp - Date.now()) / 1000));
  }

  async eval() {
    return 1;
  }

  async hgetall<T = Record<string, unknown>>(key: string): Promise<T | null> {
    if (this.isExpired(key)) return null;
    const h = this.store.get(key);
    if (h && typeof h === "object") {
      return h as T;
    }
    return null;
  }

  async hset(key: string, obj: Record<string, unknown>) {
    if (this.isExpired(key)) this.store.delete(key);
    let h = this.store.get(key) as Record<string, unknown> | undefined;
    if (!h || typeof h !== "object") {
      h = {};
      this.store.set(key, h);
    }
    Object.assign(h, obj);
    return 1;
  }
}

export function isUsingMockRedis(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return !url || !token;
}

/**
 * Upstash Redis REST client.
 * Production fails closed without Upstash env (no silent MockRedis).
 */
export function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (isProductionRuntime()) {
      throw new Error(
        "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production.",
      );
    }
    console.warn(
      "[redis] UPSTASH env not set — using in-memory MockRedis (dev only).",
    );
    return new MockRedis() as unknown as Redis;
  }

  return new Redis({ url, token });
}

const globalForRedis = globalThis as unknown as {
  madloveRedis: Redis | undefined;
};

export const redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    if (!globalForRedis.madloveRedis) {
      globalForRedis.madloveRedis = getRedis();
    }
    const instance = globalForRedis.madloveRedis;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
