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

export interface ReadResult {
  nodes: IRNode[];
  warnings: string[];
}

export interface BuilderReader {
  id: BuilderId;
  /** 0..1 confidence that this post was built with this builder. */
  detect(input: DetectInput): number;
  read(input: ReadInput): ReadResult;
}
