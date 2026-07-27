import { lookup } from 'node:dns/promises';
import net from 'node:net';

export interface GuardOptions {
  allowedHosts: ReadonlySet<string>;
}

export type GuardResult = { ok: true; ip: string } | { ok: false; reason: string };

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local
  if (a === 0) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fe80:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local, fc00::/7
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(lower);
  if (mapped) return isPrivateIPv4(mapped[1]);
  return false;
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // not a recognisable IP — refuse defensively
}

/** The SSRF mitigation for the media proxy (design spec §5.7 / §8): the
 * URL's host must be on the caller-supplied allowlist, AND the address it
 * actually resolves to must not be private/loopback/link-local. Checking
 * the *resolved* address rather than pattern-matching the hostname is
 * what stops `localhost.evil.com`-style names and DNS rebinding — a
 * hostname can be allowlisted and still resolve somewhere it shouldn't. */
export async function guardUrl(rawUrl: string, options: GuardOptions): Promise<GuardResult> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: `unsupported protocol: ${parsed.protocol}` };
  }

  if (!options.allowedHosts.has(parsed.hostname)) {
    return { ok: false, reason: `host not on the allowlist: ${parsed.hostname}` };
  }

  let address: string;
  try {
    const resolved = await lookup(parsed.hostname);
    address = resolved.address;
  } catch {
    return { ok: false, reason: `DNS lookup failed for ${parsed.hostname}` };
  }

  if (isPrivateOrLocalIp(address)) {
    return { ok: false, reason: `${parsed.hostname} resolved to a private/loopback/link-local address` };
  }

  return { ok: true, ip: address };
}
