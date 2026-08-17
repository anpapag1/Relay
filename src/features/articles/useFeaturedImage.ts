import { useState, useEffect } from 'react';
import type { DerivedArticle } from '../../state/types';
import type { AttachmentIndex } from '../../core/media/attachmentIndex';
import { matchAttachment } from '../../core/media/attachmentIndex';
import { resolveFeaturedImage } from '../../core/media/resolveFeaturedImage';
import { effectiveFallbackFeaturedImage } from '../../core/media/effectiveFallbackFeaturedImage';

export interface UseFeaturedImageResult {
  featuredImageUrl: string | null;
  featuredImageLoading: boolean;
}

export function useFeaturedImage(
  article: DerivedArticle | null,
  attachmentIndex: AttachmentIndex,
  fallbackFeaturedImageUrl?: string | null,
  fallbackFeaturedImageDataUrl?: string | null,
): UseFeaturedImageResult {
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null);
  const [featuredImageLoading, setFeaturedImageLoading] = useState(false);

  const fallbackUrl = effectiveFallbackFeaturedImage({ fallbackFeaturedImageUrl, fallbackFeaturedImageDataUrl });

  // Keyed on article.id rather than the article object itself, since
  // DerivedArticle is recomputed fresh on every render (getDerivedArticles) —
  // depending on the object would re-fetch on every unrelated state change.
  useEffect(() => {
    if (!article) {
      setFeaturedImageUrl(null);
      setFeaturedImageLoading(false);
      return;
    }

    if (article.featuredImageUrl) {
      setFeaturedImageUrl(article.featuredImageUrl);
      setFeaturedImageLoading(false);
      return;
    }

    const thumbnailId = article.postmeta?._thumbnail_id;
    if (!thumbnailId) {
      setFeaturedImageUrl(fallbackUrl);
      setFeaturedImageLoading(false);
      return;
    }

    const stage1 = matchAttachment(attachmentIndex, `attachment:${thumbnailId}`);
    if (stage1) {
      setFeaturedImageUrl(stage1);
      setFeaturedImageLoading(false);
      return undefined;
    }

    if (!article.link) {
      setFeaturedImageUrl(fallbackUrl);
      setFeaturedImageLoading(false);
      return undefined;
    }

    let ignore = false;
    setFeaturedImageUrl(null);
    setFeaturedImageLoading(true);
    const fetchImpl = window.fetch ? window.fetch.bind(window) : (async () => new Response()) as any;
    resolveFeaturedImage(article.postmeta, attachmentIndex, article.link, fetchImpl).then((result) => {
      if (ignore) return;
      setFeaturedImageUrl(result?.url ?? fallbackUrl);
      setFeaturedImageLoading(false);
    });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article?.id, attachmentIndex, fallbackUrl]);

  return { featuredImageUrl, featuredImageLoading };
}
