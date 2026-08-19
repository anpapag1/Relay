import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyBlock,
  isEditableBlock,
  singleOccurrenceIndex,
  elementOccurrenceIndex,
  replaceNth,
} from './blockEditing';

let body: HTMLDivElement;

beforeEach(() => {
  body = document.createElement('div');
  body.className = 'wp-preview-body';
  document.body.appendChild(body);
});

function editableHTML(html: string) {
  body.innerHTML = html;
  return body;
}

describe('classifyBlock / isEditableBlock', () => {
  it('classifies paragraphs, headings, list items, and quote paragraphs', () => {
    editableHTML(
      '<p>A</p><h2 class="wp-block-heading">B</h2><ul class="wp-block-list"><li>C</li></ul><blockquote class="wp-block-quote"><p>D</p><cite>E</cite></blockquote>',
    );
    const p = body.querySelector('p')!;
    const h = body.querySelector('h2')!;
    const li = body.querySelector('li')!;
    const qp = body.querySelector('blockquote p')!;
    const cite = body.querySelector('cite')!;
    expect(classifyBlock(p)).toBe('p');
    expect(classifyBlock(h)).toBe('heading');
    expect(classifyBlock(li)).toBe('li');
    expect(classifyBlock(qp)).toBe('quote-p');
    expect(classifyBlock(cite)).toBeNull();
    expect(isEditableBlock(p)).toBe(true);
    expect(isEditableBlock(h)).toBe(true);
    expect(isEditableBlock(li)).toBe(true);
    expect(isEditableBlock(qp)).toBe(true);
    expect(isEditableBlock(cite)).toBe(false);
  });
});

describe('singleOccurrenceIndex', () => {
  it('counts identical blocks before the target, by position', () => {
    editableHTML('<p>x</p><p>x</p><p>x</p>');
    const blocks = body.querySelectorAll('p');
    expect(singleOccurrenceIndex(body, blocks[0])).toBe(0);
    expect(singleOccurrenceIndex(body, blocks[1])).toBe(1);
    expect(singleOccurrenceIndex(body, blocks[2])).toBe(2);
  });

  it('respects an explicit needle independent of the target text', () => {
    editableHTML('<p>x</p><p>x</p><p>y</p>');
    const blocks = body.querySelectorAll('p');
    expect(singleOccurrenceIndex(body, blocks[2], blocks[0].outerHTML)).toBe(2);
  });
});

describe('elementOccurrenceIndex', () => {
  it('counts identical elements before the target, by position', () => {
    editableHTML('<ul class="wp-block-list"><li>a</li></ul><p>x</p><ul class="wp-block-list"><li>a</li></ul>');
    const uls = body.querySelectorAll('ul');
    expect(elementOccurrenceIndex(body, uls[0])).toBe(0);
    expect(elementOccurrenceIndex(body, uls[1])).toBe(1);
  });
});

describe('replaceNth', () => {
  it('replaces the nth occurrence of a needle', () => {
    expect(replaceNth('a X a X a', 'X', 0, 'Y')).toBe('a Y a X a');
    expect(replaceNth('a X a X a', 'X', 1, 'Y')).toBe('a X a Y a');
  });

  it('returns the input unchanged when the needle occurs fewer than n+1 times', () => {
    expect(replaceNth('a X a', 'X', 3, 'Y')).toBe('a X a');
  });
});
