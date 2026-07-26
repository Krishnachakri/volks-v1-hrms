import { crypto } from '@electric-sql/pglite';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEvent {
  timestamp: string;
  level: LogLevel;
  service: string;
  environment: string;
  requestId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  eventType?: string;
  tenantId?: string;
  actorRole?: string;
  message: string;
  details?: Record<string, any>;
  error?: string;
}

const REDACT_KEYS = [
  'password',
  'password_hash',
  'token',
  'authorization',
  'secret',
  'bank_account',
  'national_id',
  'aadhaar',
  'ssn',
  'salary',
  'net_salary',
  'compensation',
];

export function redactSensitiveFields(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveFields);
  }

  const redacted: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = REDACT_KEYS.some((k) => lowerKey.includes(k));
    if (isSensitive) {
      redacted[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object') {
      redacted[key] = redactSensitiveFields(obj[key]);
    } else {
      redacted[key] = obj[key];
    }
  }
  return redacted;
}

export function formatJsonLog(event: LogEvent): string {
  const sanitized = redactSensitiveFields(event);
  return JSON.stringify(sanitized);
}

class Logger {
  private service = 'volks-api';
  private environment = process.env.NODE_ENV || 'development';

  public log(level: LogLevel, message: string, meta: Partial<LogEvent> = {}) {
    const payload: LogEvent = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      environment: this.environment,
      message,
      ...meta,
    };
    const jsonStr = formatJsonLog(payload);
    if (level === 'error' || level === 'fatal') {
      console.error(jsonStr);
    } else {
      console.log(jsonStr);
    }
    return payload;
  }

  public info(message: string, meta: Partial<LogEvent> = {}) {
    return this.log('info', message, meta);
  }

  public warn(message: string, meta: Partial<LogEvent> = {}) {
    return this.log('warn', message, meta);
  }

  public error(message: string, meta: Partial<LogEvent> = {}) {
    return this.log('error', message, meta);
  }

  public security(eventType: string, message: string, meta: Partial<LogEvent> = {}) {
    return this.log('warn', `[SECURITY] ${message}`, { eventType, ...meta });
  }

  public business(eventType: string, message: string, meta: Partial<LogEvent> = {}) {
    return this.log('info', `[BUSINESS] ${message}`, { eventType, ...meta });
  }
}

export const logger = new Logger();
