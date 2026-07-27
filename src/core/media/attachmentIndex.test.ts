import { describe, expect, it } from 'vitest';
import { buildAttachmentIndex, filenameOf, matchAttachment, stripSizeSuffix } from './attachmentIndex';
import type { ParsedAttachment } from '../../types/domain';

const ATTACHMENTS: ParsedAttachment[] = [
  { postId: 10, title: 'Photo', attachmentUrl: 'https://old.example/wp-content/uploads/photo.jpg', postParent: 1 },
  { postId: 11, title: 'Doc', attachmentUrl: 'https://old.example/wp-content/uploads/doc.pdf', postParent: 2 },
];

describe('filenameOf / stripSizeSuffix', () => {
  it('extracts the last path segment', () => {
    expect(filenameOf('https://x/a/b/photo.jpg')).toBe('photo.jpg');
  });

  it('strips a WordPress thumbnail size suffix', () => {
    expect(stripSizeSuffix('photo-150x150.jpg')).toBe('photo.jpg');
    expect(stripSizeSuffix('photo.jpg')).toBe('photo.jpg');
  });
});

describe('matchAttachment', () => {
  it('matches an exact URL', () => {
    const index = buildAttachmentIndex(ATTACHMENTS);
    expect(matchAttachment(index, 'https://old.example/wp-content/uploads/photo.jpg')).toBe(
      'https://old.example/wp-content/uploads/photo.jpg',
    );
  });

  it('matches by filename when the URL differs', () => {
    const index = buildAttachmentIndex(ATTACHMENTS);
    expect(matchAttachment(index, 'https://cdn.example/cache/photo.jpg')).toBe(
      'https://old.example/wp-content/uploads/photo.jpg',
    );
  });

  it('matches a sized thumbnail reference to the original', () => {
    const index = buildAttachmentIndex(ATTACHMENTS);
    expect(matchAttachment(index, 'https://old.example/wp-content/uploads/photo-150x150.jpg')).toBe(
      'https://old.example/wp-content/uploads/photo.jpg',
    );
  });

  it('matches an attachment:<id> placeholder by wp:post_id', () => {
    const index = buildAttachmentIndex(ATTACHMENTS);
    expect(matchAttachment(index, 'attachment:10')).toBe('https://old.example/wp-content/uploads/photo.jpg');
    expect(matchAttachment(index, 'attachment:999')).toBeNull();
  });

  it('returns null for an unmatched reference', () => {
    const index = buildAttachmentIndex(ATTACHMENTS);
    expect(matchAttachment(index, 'https://old.example/wp-content/uploads/missing.jpg')).toBeNull();
  });

  it('handles an empty attachment list', () => {
    const index = buildAttachmentIndex([]);
    expect(matchAttachment(index, 'https://old.example/photo.jpg')).toBeNull();
  });
});
