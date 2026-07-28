import { describe, expect, it } from 'vitest';
import { distanceMeters } from '../utils/geo.js';

describe('distanceMeters', () => {
  it('returns ~0 for the same point', () => {
    expect(distanceMeters({ lat: 37.5, lng: 127.0 }, { lat: 37.5, lng: 127.0 })).toBeLessThan(1);
  });

  it('is about 1km for a ~0.009 lat delta near Seoul', () => {
    const a = { lat: 37.5665, lng: 126.978 };
    const b = { lat: 37.5665 + 0.009, lng: 126.978 };
    const d = distanceMeters(a, b);
    expect(d).toBeGreaterThan(900);
    expect(d).toBeLessThan(1100);
  });
});
