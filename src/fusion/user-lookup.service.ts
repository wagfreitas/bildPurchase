import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UserLookupService {
  private readonly logger = new Logger(UserLookupService.name);
  private readonly baseUrl: string;
  private readonly version: string;

  constructor(
    private readonly auth: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('FUSION_BASE_URL') || '';
    if (!this.baseUrl) {
      this.logger.warn('⚠️ FUSION_BASE_URL não configurado');
    }
    this.version = this.configService.get<string>('FUSION_REST_VERSION') || '11.13.18.05';
  }

  /**
   * Busca o email do usuário no Oracle Fusion baseado no nome
   * 
   * @param userName Nome completo do usuário (ex: "JOAO PEDRO EZOEL LEITE GHIOTTI")
   * @returns Email do usuário ou null se não encontrado
   */
  async findUserEmailByName(userName: string): Promise<string | null> {
    try {
      this.logger.log(`Buscando email do usuário: ${userName}`);

      const authHeader = this.auth.getBasicAuthHeader();
      const client = axios.create({
        baseURL: `${this.baseUrl}/fscmRestApi/resources/${this.version}`,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000,
      });

      // Normalizar o nome para busca (remover espaços extras, converter para maiúsculas)
      const normalizedName = userName.trim().toUpperCase().replace(/\s+/g, ' ');
      const firstName = normalizedName.split(' ')[0]; // Primeiro nome para busca parcial

      this.logger.log(`Nome normalizado: "${normalizedName}", Primeiro nome: "${firstName}"`);

      // Tentar buscar por PersonName (nome completo) e também por primeiro nome
      // A API do Oracle Fusion pode usar diferentes campos, vamos tentar alguns
      const searchQueries = [
        `PersonName='${normalizedName}'`,           // Match exato
        `PersonName like '${normalizedName}%'`,     // Começa com nome completo
        `PersonName like '${firstName}%'`,          // Começa com primeiro nome
        `DisplayName='${normalizedName}'`,          // Match exato DisplayName
        `DisplayName like '${normalizedName}%'`,    // Começa com DisplayName
        `DisplayName like '${firstName}%'`,         // Primeiro nome no DisplayName
      ];

      // Tentar diferentes endpoints da API Oracle Fusion
      const endpoints = ['/users', '/persons', '/employees'];
      
      for (const endpoint of endpoints) {
        for (const query of searchQueries) {
          try {
            this.logger.log(`Tentando buscar em ${endpoint} com query: ${query}`);
            
            const response = await client.get(endpoint, {
              params: {
                q: query,
                limit: 10,
                fields: 'PersonId,PersonName,EmailAddress,UserName,DisplayName,Email',
              },
            });

            const items = response.data.items || [];
            this.logger.log(`Resultados encontrados em ${endpoint}: ${items.length}`);

            if (items.length > 0) {
              // Log dos resultados para debug
              this.logger.log(`Usuários encontrados: ${JSON.stringify(items.map((u: any) => ({ 
                name: u.PersonName || u.DisplayName, 
                email: u.EmailAddress || u.Email 
              })))}`);

              // Tentar encontrar match exato primeiro
              const exactMatch = items.find(
                (user: any) => {
                  const personName = (user.PersonName || '').toUpperCase().trim();
                  const displayName = (user.DisplayName || '').toUpperCase().trim();
                  return personName === normalizedName || displayName === normalizedName;
                }
              );

              if (exactMatch && (exactMatch.EmailAddress || exactMatch.Email)) {
                const email = exactMatch.EmailAddress || exactMatch.Email;
                this.logger.log(`✅ Email encontrado (match exato) para ${userName}: ${email}`);
                return email;
              }

              // Se não encontrou match exato, tentar match parcial (começa com o nome)
              const partialMatch = items.find(
                (user: any) => {
                  const personName = (user.PersonName || '').toUpperCase().trim();
                  const displayName = (user.DisplayName || '').toUpperCase().trim();
                  return personName.startsWith(normalizedName.split(' ')[0]) || 
                         displayName.startsWith(normalizedName.split(' ')[0]);
                }
              );

              if (partialMatch && (partialMatch.EmailAddress || partialMatch.Email)) {
                const email = partialMatch.EmailAddress || partialMatch.Email;
                this.logger.log(`✅ Email encontrado (match parcial) para ${userName}: ${email}`);
                return email;
              }

              // Se não encontrou match, usar o primeiro resultado se tiver email
              const firstWithEmail = items.find((u: any) => u.EmailAddress || u.Email);
              if (firstWithEmail && (firstWithEmail.EmailAddress || firstWithEmail.Email)) {
                const email = firstWithEmail.EmailAddress || firstWithEmail.Email;
                this.logger.log(`✅ Email encontrado (primeiro resultado) para ${userName}: ${email}`);
                return email;
              }
            }
          } catch (error) {
            // Log do erro para debug
            if (error.response?.status === 401) {
              this.logger.warn(`Erro 401 ao buscar em ${endpoint} - autenticação falhou`);
            } else if (error.response?.status === 404) {
              this.logger.debug(`Endpoint ${endpoint} não encontrado (404)`);
            } else {
              this.logger.debug(`Erro ao buscar em ${endpoint} com query ${query}: ${error.message}`);
            }
            // Continuar para próxima query/endpoint
          }
        }
      }

      this.logger.warn(`❌ Email não encontrado para o usuário: ${userName}`);
      return null;

    } catch (error) {
      this.logger.error(`Erro ao buscar email do usuário ${userName}: ${error.message}`);
      
      if (error.response?.status === 404) {
        return null;
      }

      // Não lançar erro, apenas retornar null para não quebrar o fluxo
      return null;
    }
  }

  /**
   * Busca o email do usuário, com fallback para email padrão se não encontrar
   * 
   * @param userName Nome do usuário
   * @param fallbackEmail Email padrão se não encontrar
   * @returns Email do usuário ou fallback
   */
  async findUserEmailWithFallback(userName: string, fallbackEmail: string): Promise<string> {
    const email = await this.findUserEmailByName(userName);
    if (email) {
      return email;
    }
    
    this.logger.warn(`⚠️ Usando email padrão (${fallbackEmail}) para o solicitante: ${userName}`);
    return fallbackEmail;
  }
}

