export interface TextResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type TextFetchLike = (input: string) => Promise<TextResponse>;

export type SiteSource = 'rest' | 'rss';
