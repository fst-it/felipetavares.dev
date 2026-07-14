import { describe, expect, it } from 'vitest';
import { resolveTier, type TierEnvironment } from '../hero-tier';

const baseEnv: TierEnvironment = {
  motionOn: true,
  fxPreference: 'auto',
  saveData: false,
  hardwareConcurrency: 8,
  viewportWidth: 1440,
  pointerFine: true,
  webgl2Available: true,
};

describe('resolveTier', () => {
  it('returns still when motion is off, regardless of everything else', () => {
    expect(resolveTier({ ...baseEnv, motionOn: false, fxPreference: 'full' })).toBe('still');
  });

  it('returns still on Save-Data even with override full', () => {
    expect(resolveTier({ ...baseEnv, saveData: true, fxPreference: 'full' })).toBe('still');
  });

  it('returns still when hardwareConcurrency <= 2', () => {
    expect(resolveTier({ ...baseEnv, hardwareConcurrency: 2 })).toBe('still');
  });

  it('override off forces still even when the auto heuristics would pick neural', () => {
    expect(resolveTier({ ...baseEnv, fxPreference: 'off' })).toBe('still');
  });

  it('override simple forces mesh even when the auto heuristics would pick neural', () => {
    expect(resolveTier({ ...baseEnv, fxPreference: 'simple' })).toBe('mesh');
  });

  it('override full attempts neural regardless of viewport/hardware heuristics', () => {
    expect(
      resolveTier({ ...baseEnv, fxPreference: 'full', viewportWidth: 375, hardwareConcurrency: 4 })
    ).toBe('neural');
  });

  it('override full falls back to mesh when WebGL2 is unavailable', () => {
    expect(resolveTier({ ...baseEnv, fxPreference: 'full', webgl2Available: false })).toBe('mesh');
  });

  it('auto picks neural when every gate passes', () => {
    expect(resolveTier(baseEnv)).toBe('neural');
  });

  it('auto falls back to mesh below the 1024px viewport gate', () => {
    expect(resolveTier({ ...baseEnv, viewportWidth: 768 })).toBe('mesh');
  });

  it('auto falls back to mesh without pointer:fine', () => {
    expect(resolveTier({ ...baseEnv, pointerFine: false })).toBe('mesh');
  });

  it('auto falls back to mesh without WebGL2', () => {
    expect(resolveTier({ ...baseEnv, webgl2Available: false })).toBe('mesh');
  });

  it('auto falls back to mesh below hardwareConcurrency 8', () => {
    expect(resolveTier({ ...baseEnv, hardwareConcurrency: 4 })).toBe('mesh');
  });
});
