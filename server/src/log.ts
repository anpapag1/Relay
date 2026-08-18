type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: string | number | boolean | null | undefined;
}

function write(level: LogLevel, event: string, fields: LogFields): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields }) + '\n';
  if (level === 'error') {
    process.stderr.write(line);
  } else {
    process.stdout.write(line);
  }
}

/** Structured JSON-lines logger. Each call emits one machine-parseable
 * line (`{ts, level, event, ...fields}`) to stdout, or stderr for errors,
 * so proxy failures are diagnosable from container logs without the team
 * writing parsers for bespoke text formats. */
export const log = {
  info: (event: string, fields: LogFields = {}): void => write('info', event, fields),
  warn: (event: string, fields: LogFields = {}): void => write('warn', event, fields),
  error: (event: string, fields: LogFields = {}): void => write('error', event, fields),
};