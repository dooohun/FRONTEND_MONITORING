import { neon } from "@neondatabase/serverless";
import type { NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

const getSql = (): NeonQueryFunction<false, false> => {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set.");
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
};

export const sql: NeonQueryFunction<false, false> = new Proxy({} as NeonQueryFunction<false, false>, {
  apply(_target, _thisArg, args) {
    return (getSql() as unknown as (...args: unknown[]) => unknown)(...args);
  },
  get(_target, prop) {
    return (getSql() as unknown as Record<string | symbol, unknown>)[prop];
  },
});