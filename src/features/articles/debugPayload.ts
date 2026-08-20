import type { DerivedArticle } from '../../state/types';
import type { ConversionSettings } from '../../types/domain';

export interface DebugPayloadInput {
  article: DerivedArticle;
  afterHtml: string;
  draftHtml: string;
  problem: string;
  builder: string | null;
  settings: ConversionSettings;
}

export interface DebugPayload {
  app: string;
  builder: string | null;
  settings: ConversionSettings;
  article: {
    id: number;
    postId: number | null;
    postType: string;
    status: string;
    statusReason?: string;
    title: string;
    link: string;
    postDate: string;
    postName: string;
    creator: string;
    warnings: string[];
    infoWarnings: string[];
    mediaCount: number;
    isEdited: boolean;
    isExcluded: boolean;
    isManualReview: boolean;
    destinationTerms: DerivedArticle['destinationTerms'];
    featuredImageUrl?: string;
  };
  content: {
    before: string;
    after: string;
    draft: string;
  };
  problem: string;
}

export function buildDebugPayload({
  article,
  afterHtml,
  draftHtml,
  problem,
  builder,
  settings,
}: DebugPayloadInput): DebugPayload {
  return {
    app: 'Relay',
    builder,
    settings,
    article: {
      id: article.id,
      postId: article.postId,
      postType: article.postType,
      status: article.status,
      statusReason: article.statusReason,
      title: article.title,
      link: article.link,
      postDate: article.postDate,
      postName: article.postName,
      creator: article.creator,
      warnings: article.warnings,
      infoWarnings: article.infoWarnings,
      mediaCount: article.mediaCount,
      isEdited: article.isEdited,
      isExcluded: article.isExcluded,
      isManualReview: article.isManualReview,
      destinationTerms: article.destinationTerms,
      featuredImageUrl: article.featuredImageUrl,
    },
    content: {
      before: article.contentHtml,
      after: afterHtml,
      draft: draftHtml,
    },
    problem,
  };
}

export function debugFileName(postName: string, id: number): string {
  const slug = postName.trim();
  return slug ? `relay-debug-${slug}-${id}.json` : `relay-debug-${id}.json`;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}