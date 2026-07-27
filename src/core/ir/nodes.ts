export interface ImageRef {
  src: string;
  alt: string;
  caption?: string;
  href?: string;
  width?: number;
  height?: number;
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
  | { kind: 'file'; href: string; fileName: string; isPdf: boolean }
  | { kind: 'video'; src: string; provider: 'youtube' | 'vimeo' | 'file' }
  | { kind: 'separator' }
  | { kind: 'spacer'; height: number }
  | { kind: 'columns'; columns: IRNode[][] }
  | { kind: 'raw'; html: string; note: string };
