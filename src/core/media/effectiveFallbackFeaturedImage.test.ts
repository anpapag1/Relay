import { describe, expect, it } from 'vitest';
import { effectiveFallbackFeaturedImage } from './effectiveFallbackFeaturedImage';

describe('effectiveFallbackFeaturedImage', () => {
  it('returns null when neither fallback is set', () => {
    expect(effectiveFallbackFeaturedImage({})).toBeNull();
  });

  it('returns the link when only the link is set', () => {
    expect(effectiveFallbackFeaturedImage({ fallbackFeaturedImageUrl: 'https://cdn.example/fav.jpg' })).toBe(
      'https://cdn.example/fav.jpg',
    );
  });

  it('returns the data URL when only the image is set', () => {
    expect(effectiveFallbackFeaturedImage({ fallbackFeaturedImageDataUrl: 'data:image/jpeg;base64,AAA=' })).toBe(
      'data:image/jpeg;base64,AAA=',
    );
  });

  it('prefers the portable link over the in-session data URL when both are set', () => {
    expect(
      effectiveFallbackFeaturedImage({
        fallbackFeaturedImageUrl: 'https://cdn.example/fav.jpg',
        fallbackFeaturedImageDataUrl: 'data:image/jpeg;base64,AAA=',
      }),
    ).toBe('https://cdn.example/fav.jpg');
  });
});