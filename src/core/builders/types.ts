import type { IRNode } from '../ir/nodes';
import type { PostMeta } from '../../types/domain';

export type BuilderId = 'plainHtml' | 'wpbakery' | 'elementor' | 'divi';

export interface DetectInput {
  contentHtml: string;
  postmeta: PostMeta;
}

export interface ReadInput {
  contentHtml: string;
  postmeta: PostMeta;
}

export type WarningSeverity = 'review' | 'info';

/** A reader's note about one conversion decision. Most warrant a human
 * glance (`'review'`, the default) — a lossy conversion, an unrecognised
 * shortcode, a dropped element. `'info'` is reserved for cases confirmed
 * to need no attention at all (e.g. a known-empty, deterministically
 * handled pattern) — see wpbakery's sidebar-anchor case. */
export interface ReaderWarning {
  message: string;
  severity: WarningSeverity;
}

export interface ReadResult {
  nodes: IRNode[];
  warnings: ReaderWarning[];
}

export function reviewMessages(warnings: ReaderWarning[]): string[] {
  return warnings.filter((w) => w.severity === 'review').map((w) => w.message);
}

export function infoMessages(warnings: ReaderWarning[]): string[] {
  return warnings.filter((w) => w.severity === 'info').map((w) => w.message);
}

export interface BuilderReader {
  id: BuilderId;
  /** 0..1 confidence that this post was built with this builder. */
  detect(input: DetectInput): number;
  read(input: ReadInput): ReadResult;
}
