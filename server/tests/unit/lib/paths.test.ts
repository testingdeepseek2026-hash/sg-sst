import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { REPO_ROOT, resolveDbPath } from '../../../src/lib/paths.js';

const originalDbPath = process.env.DB_PATH;
const originalDataDir = process.env.SG_SST_DATA_DIR;

afterEach(() => {
  if (originalDbPath === undefined) delete process.env.DB_PATH;
  else process.env.DB_PATH = originalDbPath;

  if (originalDataDir === undefined) delete process.env.SG_SST_DATA_DIR;
  else process.env.SG_SST_DATA_DIR = originalDataDir;
});

describe('resolveDbPath', () => {
  it('usa data/ de la raíz cuando no hay variables de entorno', () => {
    delete process.env.DB_PATH;
    delete process.env.SG_SST_DATA_DIR;

    expect(resolveDbPath()).toBe(path.join(REPO_ROOT, 'data', 'sg-sst.db'));
  });

  it('resuelve DB_PATH relativo contra la raíz, no contra el cwd', () => {
    process.env.DB_PATH = './data/sg-sst.db';
    delete process.env.SG_SST_DATA_DIR;

    expect(resolveDbPath()).toBe(path.join(REPO_ROOT, 'data', 'sg-sst.db'));
  });

  it('respeta DB_PATH absoluto', () => {
    const absolute = path.join(REPO_ROOT, 'tmp', 'custom.db');
    process.env.DB_PATH = absolute;

    expect(resolveDbPath()).toBe(absolute);
  });

  it('usa SG_SST_DATA_DIR cuando no hay DB_PATH', () => {
    delete process.env.DB_PATH;
    process.env.SG_SST_DATA_DIR = './data';

    expect(resolveDbPath()).toBe(path.join(REPO_ROOT, 'data', 'sg-sst.db'));
  });

  it('prioriza SG_SST_DATA_DIR sobre DB_PATH', () => {
    process.env.DB_PATH = './data/custom.db';
    process.env.SG_SST_DATA_DIR = './otro';

    expect(resolveDbPath()).toBe(path.join(REPO_ROOT, 'otro', 'sg-sst.db'));
  });
});
