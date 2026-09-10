import { filenameOf } from './attachmentIndex';

/** WordPress's own WXR importer (`class-wp-import.php`'s `fetch_remote_file`)
 * derives the locally-saved filename from `basename(parse_url($url,
 * PHP_URL_PATH))` — the URL's raw path segment, still percent-encoded,
 * never url-decoded. `sanitize_file_name()` then strips every `%` character
 * rather than replacing it, so each encoded non-ASCII byte (`%CE`, `%91`,
 * ...) collapses from 3 characters down to 2 raw hex digits with no
 * separator — a non-Latin filename comes out roughly twice as long and
 * unreadable (`ΜΕΛΕΤΗ.pdf` becomes `CE9CCE95CE9BCE95CEA4CE97.pdf`). Past
 * ~255 bytes (the filesystem limit on effectively every Linux host) the
 * download fails outright with "File name too long" — reproduced against a
 * real WordPress install: a 132-byte Greek filename (248 bytes once
 * garbled) imports fine, a 165-byte one (311 garbled) fails every time.
 * Relay can't avoid this — `wp:attachment_url` has to stay the file's real
 * old-site URL or WordPress has nothing to download — so the only thing
 * worth doing on export is warning the user which specific files are at
 * risk, before they find out from a cryptic PHP warning after import. */
function isUnreservedAsciiByte(byte: number): boolean {
  return (
    (byte >= 0x41 && byte <= 0x5a) || // A-Z
    (byte >= 0x61 && byte <= 0x7a) || // a-z
    (byte >= 0x30 && byte <= 0x39) || // 0-9
    byte === 0x2d || // -
    byte === 0x2e || // .
    byte === 0x5f || // _
    byte === 0x7e // ~
  );
}

/** The filename length WordPress's importer would end up with after its
 * percent-encode-then-strip-`%` mangling: 1 byte per unreserved ASCII
 * character, 2 bytes (the leftover hex digits) per everything else. */
export function wordpressGarbledFilenameLength(filename: string): number {
  let length = 0;
  for (const byte of new TextEncoder().encode(filename)) {
    length += isUnreservedAsciiByte(byte) ? 1 : 2;
  }
  return length;
}

/** Just below the real ~255-byte filesystem limit, leaving a little room
 * for a `-1`/`-2` uniqueness suffix WordPress may still append. Calibrated
 * against a real WordPress import: a filename that garbles to 248 bytes
 * imports fine, one that garbles to 268 fails every time. */
export const FILENAME_IMPORT_RISK_THRESHOLD = 250;

/** Checks a resolved media URL's filename against the risk threshold,
 * returning a warning message when it's at risk — or `null` when it's
 * safe, or when there's no URL to check. */
export function filenameImportRiskWarning(url: string | null | undefined): string | null {
  if (!url) return null;
  const filename = filenameOf(url);
  if (!filename) return null;
  if (wordpressGarbledFilenameLength(filename) <= FILENAME_IMPORT_RISK_THRESHOLD) return null;
  return `"${filename}" has a long non-Latin filename that some WordPress importers fail to download ("File name too long") — consider a shorter filename on the old site, or uploading this file manually after import.`;
}
