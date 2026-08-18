import { describe, it, expect, vi, afterEach } from 'vitest';
import { log } from './log';

const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

afterEach(() => {
  stdoutSpy.mockClear();
  stderrSpy.mockClear();
});

describe('log', () => {
  it('emits a JSON line to stdout with timestamp, level, event, and fields', () => {
    log.info('request', { method: 'GET', path: '/api/fetch', status: 200 });

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const [line] = stdoutSpy.mock.calls[0] as [string];
    const parsed = JSON.parse(line) as { ts: string; level: string; event: string; method: string; path: string; status: number };
    expect(parsed.level).toBe('info');
    expect(parsed.event).toBe('request');
    expect(parsed.method).toBe('GET');
    expect(parsed.path).toBe('/api/fetch');
    expect(parsed.status).toBe(200);
    expect(Number.isNaN(Date.parse(parsed.ts))).toBe(false);
  });

  it('works without fields', () => {
    log.info('listening');

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const [line] = stdoutSpy.mock.calls[0] as [string];
    const parsed = JSON.parse(line) as { event: string };
    expect(parsed.event).toBe('listening');
  });

  it('sends warn to stdout and error to stderr', () => {
    log.warn('proxy_failed', { reason: 'boom' });
    log.error('handler_error', { error: 'crash' });

    const [warnLine] = stdoutSpy.mock.calls[0] as [string];
    expect(JSON.parse(warnLine) as { level: string }).toEqual({ level: 'warn', ts: expect.any(String), event: 'proxy_failed', reason: 'boom' });

    const [errLine] = stderrSpy.mock.calls[0] as [string];
    expect(JSON.parse(errLine) as { level: string }).toEqual({ level: 'error', ts: expect.any(String), event: 'handler_error', error: 'crash' });
    expect(stderrSpy).toHaveBeenCalledTimes(1);
  });
});