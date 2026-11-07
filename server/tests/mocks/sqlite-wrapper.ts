// Wrapper for node:sqlite to avoid Vite resolution issues
const sqlite = await import('node:sqlite');

export const { DatabaseSync } = sqlite;