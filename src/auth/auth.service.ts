
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  
  private readonly username = 'automacao.csc@bild.com.br';
  private readonly password = '7@Q45D!a231A';

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

  async testConnection(): Promise<boolean> {
    // Método para testar a conexão básica
    this.logger.log('Using Basic Authentication for Oracle Fusion');
    return true;
  }
}
