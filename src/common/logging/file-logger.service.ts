import { Injectable } from '@nestjs/common';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

@Injectable()
export class FileLoggerService {
  private readonly logDir = join(process.cwd(), 'logs');
  private readonly logFile = join(this.logDir, 'app.log');

  constructor() {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  log(message: string, context?: Record<string, any>): void {
    const entry = this.buildEntry('INFO', message, context);
    appendFileSync(this.logFile, entry + '\n');
  }

  error(message: string, context?: Record<string, any>): void {
    const entry = this.buildEntry('ERROR', message, context);
    appendFileSync(this.logFile, entry + '\n');
  }

  private buildEntry(level: 'INFO' | 'ERROR', message: string, context?: Record<string, any>): string {
    const timestamp = new Date().toISOString();
    const payload = {
      timestamp,
      level,
      message,
      ...(context ? { context } : {}),
    };
    return JSON.stringify(payload);
  }
}


