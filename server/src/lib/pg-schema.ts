import type { PoolClient } from 'pg';

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function getPublicTables(client: PoolClient): Promise<string[]> {
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  return rows.map((row) => row.table_name).filter((name) => name !== 'schema_migrations');
}

export async function getForeignKeyEdges(
  client: PoolClient
): Promise<Array<{ table: string; referenced: string }>> {
  const { rows } = await client.query<{ table: string; referenced: string }>(
    `SELECT tc.table_name AS table, ccu.table_name AS referenced
     FROM information_schema.table_constraints tc
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.constraint_schema = tc.constraint_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = 'public'`
  );
  return rows;
}

export function orderTablesByDependencies(
  tables: string[],
  references: Array<{ table: string; referenced: string }>
): string[] {
  const present = new Set(tables);
  const dependencies = new Map<string, Set<string>>();
  for (const table of tables) dependencies.set(table, new Set());

  for (const relation of references) {
    if (relation.table === relation.referenced) continue;
    if (present.has(relation.table) && present.has(relation.referenced)) {
      dependencies.get(relation.table)!.add(relation.referenced);
    }
  }

  const ordered: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (table: string): void => {
    if (visited.has(table)) return;
    if (visiting.has(table)) {
      console.warn(
        `[PG-SCHEMA] Ciclo de claves foráneas detectado en ${table}; se conserva el orden parcial.`
      );
      return;
    }
    visiting.add(table);
    for (const dependency of dependencies.get(table) ?? []) visit(dependency);
    visiting.delete(table);
    visited.add(table);
    ordered.push(table);
  };

  for (const table of [...tables].sort()) visit(table);
  return ordered;
}
