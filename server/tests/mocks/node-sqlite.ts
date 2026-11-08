// Mock for node:sqlite in tests
// Provides a minimal DatabaseSync API compatible with our usage

interface Statement {
  run(...params: any[]): { changes: number; lastInsertRowid: string | number };
  get(...params: any[]): any;
  all(...params: any[]): any[];
  iterate(...params: any[]): IterableIterator<any>;
}

export class DatabaseSync {
  private db: Map<string, any[]> = new Map();
  private autoIncrement: Map<string, number> = new Map();
  private schema: Map<string, string[]> = new Map();

  constructor(filename: string) {
    if (filename !== ':memory:') {
      throw new Error('Only :memory: supported in mock');
    }
    this.initializeSchema();
  }

  private initializeSchema() {
    // Create sqlite_sequence table for auto-increment simulation
    this.db.set('sqlite_sequence', []);
  }

  exec(sql: string): void {
    // Handle PRAGMA
    if (sql.includes('PRAGMA foreign_keys')) return;

    // Handle CREATE TABLE
    const createMatch = sql.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\s*\(([^)]+)\)/i);
    if (createMatch) {
      const tableName = createMatch[1];
      const columns = createMatch[2].split(',').map((c) => c.trim().split(/\s+/)[0]);
      this.db.set(tableName, []);
      this.autoIncrement.set(tableName, 1);
      this.schema.set(tableName, columns);
      return;
    }

    // Handle INSERT
    const insertMatch = sql.match(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/i);
    if (insertMatch) {
      const tableName = insertMatch[1];
      const cols = insertMatch[2].split(',').map((c) => c.trim());
      const values = insertMatch[3].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));

      const row: any = {};
      cols.forEach((col, i) => {
        row[col] = values[i];
      });

      // Handle auto-increment id
      if (!row.id && this.autoIncrement.has(tableName)) {
        const nextId = this.autoIncrement.get(tableName)!;
        row.id = `test-${nextId}`;
        this.autoIncrement.set(tableName, nextId + 1);
      }

      const table = this.db.get(tableName) || [];
      table.push(row);
      this.db.set(tableName, table);
      return;
    }

    // Handle DELETE
    const deleteMatch = sql.match(/DELETE FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i);
    if (deleteMatch) {
      const tableName = deleteMatch[1];
      if (deleteMatch[2]) {
        // Simple WHERE clause handling
        // For simplicity, just clear all if there's a where clause in tests
        this.db.set(tableName, []);
      } else {
        this.db.set(tableName, []);
      }
      return;
    }
  }

  prepare(sql: string): Statement {
    const self = this;
    return {
      run(...params: any[]) {
        // Extract table name and operation
        const insertMatch = sql.match(/INSERT INTO\s+(\w+)/i);
        const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
        const deleteMatch = sql.match(/DELETE FROM\s+(\w+)/i);

        if (insertMatch) {
          const tableName = insertMatch[1];
          const table = self.db.get(tableName) || [];
          const colsMatch = sql.match(/\(([^)]+)\)\s*VALUES/);
          const cols = colsMatch ? colsMatch[1].split(',').map((c) => c.trim()) : [];

          const row: any = {};
          cols.forEach((col, i) => {
            row[col] = params[i];
          });

          if (!row.id && self.autoIncrement.has(tableName)) {
            const nextId = self.autoIncrement.get(tableName)!;
            row.id = `test-${nextId}`;
            self.autoIncrement.set(tableName, nextId + 1);
          }

          table.push(row);
          self.db.set(tableName, table);
          return { changes: 1, lastInsertRowid: row.id };
        }

        if (updateMatch) {
          const tableName = updateMatch[1];
          const table = self.db.get(tableName) || [];
          // Simplified: just return changes
          return { changes: table.length };
        }

        if (deleteMatch) {
          const tableName = deleteMatch[1];
          const table = self.db.get(tableName) || [];
          const count = table.length;
          self.db.set(tableName, []);
          return { changes: count };
        }

        return { changes: 0 };
      },

      get(..._params: any[]) {
        const selectMatch = sql.match(/SELECT\s+(.+)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i);
        if (selectMatch) {
          const tableName = selectMatch[2];
          const table = self.db.get(tableName) || [];
          if (selectMatch[3]) {
            // WHERE clause - simplified
            return table[0] || undefined;
          }
          return table[0] || undefined;
        }
        return undefined;
      },

      all(...params: any[]) {
        const selectMatch = sql.match(/SELECT\s+(.+)\s+FROM\s+(\w+)(?:\s+WHERE\s+(.+))?/i);
        if (selectMatch) {
          const tableName = selectMatch[2];
          const table = self.db.get(tableName) || [];
          if (selectMatch[3]) {
            // WHERE clause - simplified filtering
            const where = selectMatch[3];
            // Very basic where parsing for tests
            return table.filter((row) => {
              // Check simple conditions like "worker_id = ?"
              const condMatch = where.match(/(\w+)\s*=\s*\?/);
              if (condMatch) {
                const col = condMatch[1];
                return row[col] === params[0];
              }
              return true;
            });
          }
          return [...table];
        }
        return [];
      },

      iterate(..._params: any[]) {
        return this.all(..._params)[Symbol.iterator]();
      },
    };
  }

  close(): void {
    this.db.clear();
  }
}
