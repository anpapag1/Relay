import { describe, expect, it } from 'vitest';
import { filenameImportRiskWarning, wordpressGarbledFilenameLength } from './filenameImportRisk';

describe('wordpressGarbledFilenameLength', () => {
  it('counts an ASCII filename as itself, one byte per character', () => {
    expect(wordpressGarbledFilenameLength('report.pdf')).toBe(10);
  });

  it('counts each non-ASCII byte as 2 (the leftover hex digits once WordPress strips the %)', () => {
    // "Α" is a 2-byte UTF-8 character -> 4 garbled chars; ".pdf" stays 4.
    expect(wordpressGarbledFilenameLength('Α.pdf')).toBe(4 + 4);
  });

  it('matches the real, empirically-verified boundary between an import that succeeds and one that fails', () => {
    const succeeds = '1.ΤΕΧΝΙΚΗ-ΠΕΡΙΓΡΑΦΗ-ΓΙΑ-ΤΗΝ-ΠΡΟΜΗΘΕΙΑ-ΠΡΩΤΩΝ-ΥΛΩΝ-ΣΤΗ-ΓΙΟΡΤΗ-ΤΟΥ-ΣΥΚΟΥ.pdf';
    const fails = '1.-ΑΠΟΦΑΣΗ-ΔΗΜΑΡΧΟΥ-ΓΙΑ-ΔΙΕΝΕΡΓΕΙΑ-ΑΠ΄-ΕΥΘΕΙΑΣ-ΑΝΑΘΕΣΗΣ_-ΣΥΝΤΗΡΗΣΗ-ΣΚ-ΔΕ-ΓΕΡΑΣ-ΠΛΩΜΑΡΙΟΥ.pdf';
    expect(wordpressGarbledFilenameLength(succeeds)).toBeLessThanOrEqual(250);
    expect(wordpressGarbledFilenameLength(fails)).toBeGreaterThan(250);
  });
});

describe('filenameImportRiskWarning', () => {
  it('returns null for a short/Latin filename', () => {
    expect(filenameImportRiskWarning('https://old.example/wp-content/uploads/report.pdf')).toBeNull();
  });

  it('returns null when there is no url', () => {
    expect(filenameImportRiskWarning(undefined)).toBeNull();
    expect(filenameImportRiskWarning(null)).toBeNull();
    expect(filenameImportRiskWarning('')).toBeNull();
  });

  it('warns, naming the file, when the filename is at risk', () => {
    const url =
      'https://old.example/wp-content/uploads/2026/08/1.-%CE%91%CE%A0%CE%9F%CE%A6%CE%91%CE%A3%CE%97-%CE%94%CE%97%CE%9C%CE%91%CE%A1%CE%A7%CE%9F%CE%A5-%CE%93%CE%99%CE%91-%CE%94%CE%99%CE%95%CE%9D%CE%95%CE%A1%CE%93%CE%95%CE%99%CE%91-%CE%91%CE%A0%CE%84-%CE%95%CE%A5%CE%98%CE%95%CE%99%CE%91%CE%A3-%CE%91%CE%9D%CE%91%CE%98%CE%95%CE%A3%CE%97%CE%A3_-%CE%A3%CE%A5%CE%9D%CE%A4%CE%97%CE%A1%CE%97%CE%A3%CE%97-%CE%A3%CE%9A-%CE%94%CE%95-%CE%93%CE%95%CE%A1%CE%91%CE%A3-%CE%A0%CE%9B%CE%A9%CE%9C%CE%91%CE%A1%CE%99%CE%9F%CE%A5.pdf';
    const warning = filenameImportRiskWarning(url);
    expect(warning).not.toBeNull();
    expect(warning).toContain('ΓΕΡΑΣ-ΠΛΩΜΑΡΙΟΥ');
    expect(warning).toContain('File name too long');
  });
});
