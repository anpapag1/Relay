const CHROME_CLASS_MARKERS = [
  'pdfprnt',
  'print-button',
  'printbtn',
  'share-button',
  'share-buttons',
  'share-this',
  'social-share',
  'social-sharing',
  'addtoany',
  'a2a',
  'shariff',
  'sfsi',
];

function isChromeToken(token: string): boolean {
  return CHROME_CLASS_MARKERS.some(
    (marker) => token === marker || token.startsWith(`${marker}-`) || token.startsWith(`${marker}_`),
  );
}

function hasChromeClass(el: Element): boolean {
  const cls = el.getAttribute('class');
  if (!cls) return false;
  return cls.split(/\s+/).filter(Boolean).some(isChromeToken);
}

/**
 * Removes plugin chrome injected into rendered article HTML (e.g. WordPress
 * PDF/print and social-share buttons) by stripping elements whose class names
 * carry a known plugin marker. Returns the input unchanged when nothing was
 * removed, so clean content is never re-serialized.
 */
export function cleanSiteContent(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  let removed = false;

  const walk = (root: Element): void => {
    for (const el of Array.from(root.children)) {
      if (hasChromeClass(el)) {
        el.remove();
        removed = true;
      } else {
        walk(el);
      }
    }
  };
  walk(body);

  return removed ? body.innerHTML : html;
}