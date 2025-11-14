
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
      this.logger.error('❌ FUSION_USERNAME ou FUSION_PASSWORD não configurados no .env');
      this.logger.error('   Configure as variáveis: FUSION_USERNAME e FUSION_PASSWORD');
    } else {
      this.logger.log(`✅ Credenciais configuradas - Usuário: ${this.username}`);
    }
  }

  getBasicAuthHeader(): string {
    if (!this.username || !this.password) {
      this.logger.error('❌ Tentativa de gerar Basic Auth sem credenciais configuradas');
      throw new Error('FUSION_USERNAME e FUSION_PASSWORD devem estar configurados');
    }
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
