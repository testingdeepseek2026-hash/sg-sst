import { vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { runMigrations } from '../src/lib/db.js';

vi.mock('node:sqlite', () => process.getBuiltinModule('node:sqlite'));

global.console = {
  ...console,
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

export function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  runMigrations(db);
  return db;
}

export function cleanDb(db: DatabaseSync): void {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const { name } of tables.reverse()) {
    db.prepare(`DELETE FROM "${name}"`).run();
  }
  db.exec('PRAGMA foreign_keys = ON;');
}

export function resetSequences(db: DatabaseSync): void {
  db.prepare('DELETE FROM sqlite_sequence').run();
}

expect.extend({
  toBeValidDate(received: string) {
    const pass = !Number.isNaN(new Date(received).getTime());
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid date`
        : `expected ${received} to be a valid date`,
    };
  },
  toBeValidUUID(received: string) {
    const pass = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(received);
    return {
      pass,
      message: () => pass
        ? `expected ${received} not to be a valid UUID`
        : `expected ${received} to be a valid UUID`,
    };
  },
});

declare global {
  namespace Vi {
    interface JestAssertion<T = any> {
      toBeValidDate(): T;
      toBeValidUUID(): T;
    }
  }
}
