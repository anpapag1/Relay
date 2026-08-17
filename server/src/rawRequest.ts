import http from 'node:http';
import https from 'node:https';

class TimeoutError extends Error {}
class SizeLimitError extends Error {}

interface RawResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

function requestOnce(url: URL, timeoutMs: number, maxBytes: number): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(url, { headers: { 'User-Agent': 'RelayMediaProxy/1.0' } }, (res) => {
      const chunks: Buffer[] = [];
      let total = 0;

      res.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > maxBytes) {
          req.destroy();
          reject(new SizeLimitError('response exceeded the size cap'));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) });
      });

      res.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new TimeoutError('request timed out'));
    });
  });
}

export { requestOnce, TimeoutError, SizeLimitError, type RawResponse };
