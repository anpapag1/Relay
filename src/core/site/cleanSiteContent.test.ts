import { describe, it, expect } from 'vitest';
import { cleanSiteContent } from './cleanSiteContent';

const PDFPRNT_HTML =
  '<p>Real article body text.</p>' +
  '<div class="pdfprnt-buttons pdfprnt-buttons-post pdfprnt-bottom-left">' +
  '<a class="pdfprnt-button pdfprnt-button-print" href="https://site.example/post/?print=print" target="_blank">' +
  '<span class="pdfprnt-button-title pdfprnt-butto">Print</span></a></div>';

describe('cleanSiteContent', () => {
  it('removes pdfprnt plugin chrome (the observed PDF & Print buttons)', () => {
    expect(cleanSiteContent(PDFPRNT_HTML)).toBe('<p>Real article body text.</p>');
  });

  it('removes nested share-button chrome', () => {
    const html =
      '<p>Body.</p><div class="share-buttons"><a class="share-button share-facebook" href="https://facebook.com">Share</a></div>';
    expect(cleanSiteContent(html)).toBe('<p>Body.</p>');
  });

  it('leaves ordinary article content untouched', () => {
    const html = '<p>Hello <strong>world</strong>.</p><img src="https://site.example/pic.jpg" alt="share" />';
    expect(cleanSiteContent(html)).toBe(html);
  });

  it('returns the original string unchanged when nothing is removed', () => {
    const html = '<p>a</p><p>b</p>';
    expect(cleanSiteContent(html)).toBe(html);
  });

  it('does not treat the word "print"/"share" in text or alt text as chrome', () => {
    const html = '<p>Press the share button to print this page.</p><img src="x.jpg" alt="share" />';
    expect(cleanSiteContent(html)).toBe(html);
  });
});