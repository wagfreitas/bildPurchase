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
   * IMPORTANTE: A API de usuários (/users, /persons, /employees) não está disponível
   * para o usuário automacao.csc@bild.com.br devido a restrições de permissão.
   * 
   * Endpoints testados:
   * - /fscmRestApi/resources/latest/users → 404 (não existe)
   * - /fscmRestApi/resources/latest/workers → 404 (não existe)
   * - /hcmRestApi/resources/latest/employees → 404 (módulo HCM não disponível)
   * - /hcmRestApi/resources/latest/emps → 403 (sem permissão)
   * 
   * ALTERNATIVAS:
   * 1. Fornecer requesterEmail diretamente no input (RECOMENDADO)
   * 2. Consultar PRs anteriores do mesmo requester para descobrir o email
   * 3. Manter mapeamento local nome→email em banco de dados
   * 
   * @param userName Nome completo do usuário (ex: "JOAO PEDRO EZOEL LEITE GHIOTTI")
   * @returns Email do usuário ou null se não encontrado
   */
  async findUserEmailByName(userName: string): Promise<string | null> {
    try {
      this.logger.log(`⚠️ Busca de email por nome desabilitada - API de usuários não disponível`);
      this.logger.log(`Nome solicitado: ${userName}`);
      this.logger.log(`Recomendação: Fornecer o requesterEmail diretamente no input`);
      
      // TODO: Implementar busca em PRs anteriores do mesmo requester
      // const email = await this.findEmailFromPreviousPRs(userName);
      // if (email) return email;
      
      return null;

    } catch (error) {
      this.logger.error(`Erro ao buscar email do usuário ${userName}: ${error.message}`);
      return null;
    }
  }

  /**
   * Busca o email do requester em Purchase Requisitions anteriores
   * Esta é a única fonte confiável de emails disponível via API SCM
   * 
   * @param userName Nome do requester
   * @returns Email encontrado ou null
   */
  private async findEmailFromPreviousPRs(userName: string): Promise<string | null> {
    try {
      const normalizedName = userName.trim().toUpperCase().replace(/\s+/g, ' ');
      this.logger.log(`🔍 Buscando email em PRs anteriores para: ${normalizedName}`);

      const authHeader = this.auth.getBasicAuthHeader();
      const client = axios.create({
        baseURL: `${this.baseUrl}/fscmRestApi/resources/latest`,
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 30000,
      });

      // Buscar PRs recentes deste requester
      const response = await client.get('/purchaseRequisitions', {
        params: {
          q: `Requester='${normalizedName}'`,
          limit: 1,
          fields: 'RequisitionHeaderId,Requester,RequesterEmail',
        },
      });

      const items = response.data.items || [];
      
      if (items.length > 0 && items[0].RequesterEmail) {
        const email = items[0].RequesterEmail;
        this.logger.log(`✅ Email encontrado em PR anterior: ${email}`);
        return email;
      }

      this.logger.log(`⚠️ Nenhuma PR anterior encontrada para ${normalizedName}`);
      return null;

    } catch (error) {
      this.logger.debug(`Erro ao buscar em PRs anteriores: ${error.message}`);
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

