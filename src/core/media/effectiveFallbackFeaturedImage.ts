/** The winning fallback article featured image: the portable link first,
 * the in-session uploaded data URL second, else null. Shared by the build
 * (runBuild) and the article preview (useFeaturedImage) so both apply the
 * exact same precedence. */
export function effectiveFallbackFeaturedImage(settings: {
  fallbackFeaturedImageUrl?: string | null;
  fallbackFeaturedImageDataUrl?: string | null;
}): string | null {
  return settings.fallbackFeaturedImageUrl ?? settings.fallbackFeaturedImageDataUrl ?? null;
}