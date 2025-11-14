
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly username: string;
  private readonly password: string;

  constructor(private readonly configService: ConfigService) {
    this.username = this.configService.get<string>('FUSION_USERNAME') || '';
    this.password = this.configService.get<string>('FUSION_PASSWORD') || '';
    
    if (!this.username || !this.password) {
      this.logger.warn('⚠️ FUSION_USERNAME ou FUSION_PASSWORD não configurados');
    }
  }

  getBasicAuthHeader(): string {
    const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
    return `Basic ${credentials}`;
  }

  getCredentials() {
    return {
      username: this.username,
      password: this.password,
    };
  }
}
