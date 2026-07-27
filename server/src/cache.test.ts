import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCached, setCached, clearCache } from './cache';

describe('cache', () => {
  beforeEach(() => {
    clearCache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null for non-existent key', () => {
    expect(getCached('https://example.com')).toBeNull();
  });

  it('should store and retrieve cached values', () => {
    const data = { ogImage: null, images: ['img1.png'], files: [] };
    setCached('https://example.com/page1', data);
    expect(getCached('https://example.com/page1')).toEqual(data);
  });

  it('should expire cached values after TTL', () => {
    const data = { ogImage: null, images: ['img1.png'], files: [] };
    setCached('https://example.com/page1', data, 1000); // 1s TTL

    vi.advanceTimersByTime(500);
    expect(getCached('https://example.com/page1')).toEqual(data);

    vi.advanceTimersByTime(501);
    expect(getCached('https://example.com/page1')).toBeNull();
  });

  it('should clear all cached values when clearCache is called', () => {
    setCached('https://example.com/1', { val: 1 });
    setCached('https://example.com/2', { val: 2 });
    clearCache();
    expect(getCached('https://example.com/1')).toBeNull();
    expect(getCached('https://example.com/2')).toBeNull();
  });
});
