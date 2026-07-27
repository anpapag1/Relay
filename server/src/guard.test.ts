import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lookup } from 'node:dns/promises';
import { guardUrl } from './guard';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

describe('guardUrl', () => {
  const allowedHosts = new Set(['example.com', 'localhost.evil.com', 'rebind.test']);

  beforeEach(() => {
    vi.mocked(lookup).mockReset();
    vi.mocked(lookup).mockResolvedValue({ address: '93.184.216.34', family: 4 });
  });

  it('should succeed for an allowlisted host resolving to a public IP', async () => {
    const res = await guardUrl('https://example.com/some/path', { allowedHosts });
    expect(res).toEqual({ ok: true, ip: '93.184.216.34' });
  });

  it('should refuse when URL is invalid', async () => {
    const res = await guardUrl('not-a-url', { allowedHosts });
    expect(res).toEqual({ ok: false, reason: 'invalid URL' });
  });

  it('should refuse when protocol is unsupported', async () => {
    const res = await guardUrl('ftp://example.com/file', { allowedHosts });
    expect(res).toEqual({ ok: false, reason: 'unsupported protocol: ftp:' });

    const fileRes = await guardUrl('file:///etc/passwd', { allowedHosts });
    expect(fileRes).toEqual({ ok: false, reason: 'unsupported protocol: file:' });
  });

  it('should refuse when host is not on the allowlist', async () => {
    const res = await guardUrl('https://evil.com/path', { allowedHosts });
    expect(res).toEqual({ ok: false, reason: 'host not on the allowlist: evil.com' });
  });

  it('should refuse when DNS lookup fails', async () => {
    vi.mocked(lookup).mockRejectedValueOnce(new Error('ENOTFOUND'));
    const res = await guardUrl('https://example.com/path', { allowedHosts });
    expect(res).toEqual({ ok: false, reason: 'DNS lookup failed for example.com' });
  });

  describe('adversarial IP ranges', () => {
    const privateIPv4s = [
      '127.0.0.1',    // loopback
      '127.10.0.1',   // loopback range
      '10.0.0.1',     // RFC1918 10.0.0.0/8
      '172.16.0.1',   // RFC1918 172.16.0.0/12
      '172.31.255.1', // RFC1918 172.16.0.0/12
      '192.168.1.1',  // RFC1918 192.168.0.0/16
      '169.254.10.5', // link-local 169.254.0.0/16
      '0.0.0.0',      // current network / unspecified
    ];

    for (const ip of privateIPv4s) {
      it(`should refuse private IPv4 address ${ip}`, async () => {
        vi.mocked(lookup).mockResolvedValueOnce({ address: ip, family: 4 });
        const res = await guardUrl('https://example.com/test', { allowedHosts });
        expect(res).toEqual({
          ok: false,
          reason: 'example.com resolved to a private/loopback/link-local address',
        });
      });
    }

    const privateIPv6s = [
      '::1',                   // loopback
      'fe80::1',               // link-local
      'fc00::abc:123',         // unique-local
      'fd12:3456::1',          // unique-local
      '::ffff:127.0.0.1',      // mapped IPv4 loopback
      '::ffff:10.0.0.1',       // mapped IPv4 RFC1918
    ];

    for (const ip of privateIPv6s) {
      it(`should refuse private IPv6 address ${ip}`, async () => {
        vi.mocked(lookup).mockResolvedValueOnce({ address: ip, family: 6 });
        const res = await guardUrl('https://example.com/test', { allowedHosts });
        expect(res).toEqual({
          ok: false,
          reason: 'example.com resolved to a private/loopback/link-local address',
        });
      });
    }
  });

  describe('DNS rebinding / localhost.evil.com style attacks', () => {
    it('should refuse when allowlisted host resolves to loopback IP', async () => {
      vi.mocked(lookup).mockResolvedValueOnce({ address: '127.0.0.1', family: 4 });
      const res = await guardUrl('http://localhost.evil.com/admin', { allowedHosts });
      expect(res).toEqual({
        ok: false,
        reason: 'localhost.evil.com resolved to a private/loopback/link-local address',
      });
    });

    it('should refuse when allowlisted host resolves to internal network IP', async () => {
      vi.mocked(lookup).mockResolvedValueOnce({ address: '192.168.0.254', family: 4 });
      const res = await guardUrl('https://rebind.test/secret', { allowedHosts });
      expect(res).toEqual({
        ok: false,
        reason: 'rebind.test resolved to a private/loopback/link-local address',
      });
    });
  });
});
