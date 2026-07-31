export interface ImageRef {
  src: string;
  alt: string;
  caption?: string;
  href?: string;
  width?: number;
  height?: number;
  /** The resolved image's synthetic WXR attachment id, once known — set by
   * rewriteMediaRefs from the same attachment registry generateWxr uses to
   * emit the matching `<wp:attachment>` item, so a real WordPress-authored
   * image's `id`/`wp-image-<id>` linkage is preserved rather than the
   * image floating unattached in the new post. */
  attachmentId?: number;
}

/** The contract every builder reader produces and the only thing
 * writeBlocks consumes — readers and the writer never need to know about
 * each other. */
export type IRNode =
  | { kind: 'paragraph'; html: string }
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; html: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'quote'; html: string; cite?: string }
  | ({ kind: 'image' } & ImageRef)
  | { kind: 'gallery'; images: ImageRef[] }
  | { kind: 'button'; text: string; href: string }
  // attachmentId mirrors ImageRef's — set by rewriteMediaRefs from the same
  // attachment registry generateWxr uses to emit the matching
  // <wp:attachment> item, so the wp:file block's `id` links to a real
  // migrated attachment on the new site instead of just linking back to
  // the old site's URL.
  | { kind: 'file'; href: string; fileName: string; isPdf: boolean; attachmentId?: number }
  | { kind: 'video'; src: string; provider: 'youtube' | 'vimeo' | 'file' }
  | { kind: 'separator' }
  | { kind: 'spacer'; height: number }
  | { kind: 'columns'; columns: IRNode[][] }
  | { kind: 'table'; html: string }
  | { kind: 'raw'; html: string; note: string };
