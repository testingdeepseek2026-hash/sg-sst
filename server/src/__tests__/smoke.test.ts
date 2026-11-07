import { describe, it, expect } from 'vitest';
import { genId, nowISO, daysBetween } from '../lib/utils.js';

describe('smoke: utilidades', () => {
  it('genera ids unicos', () => {
    expect(genId()).not.toBe(genId());
    expect(genId().length).toBeGreaterThan(10);
  });
  it('calcula dias entre fechas', () => {
    expect(daysBetween('2026-11-01', '2026-11-07')).toBe(6);
    expect(daysBetween('2026-11-07', '2026-11-01')).toBe(-6);
  });
  it('nowISO devuelve ISO', () => {
    expect(nowISO()).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
