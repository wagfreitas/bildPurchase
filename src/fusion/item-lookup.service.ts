import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthService } from '../auth/auth.service';

/**
 * Serviço para buscar itens no Oracle Fusion
 * 
 * Usa a API ItemsV2 do Oracle Fusion para buscar informações de itens
 */
@Injectable()
export class ItemLookupService {
  private readonly logger = new Logger(ItemLookupService.name);
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
   * Busca um item em uma organização específica
   * 
   * IMPORTANTE: Para Purchase Requisitions, o item PRECISA estar associado à organização
   * da Business Unit. Se não estiver, a organização não pode fazer requisições para esse item.
   * 
   * @param itemNumber Número do item
   * @param organizationCode Código da organização (obrigatório para validação de associação)
   * @returns Item encontrado na organização ou null se não estiver associado
   */
  async findItemByNumber(itemNumber: string, organizationCode: string): Promise<any> {
    try {
      this.logger.log(`Buscando item ${itemNumber} na organização: ${organizationCode}`);

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

      // Buscar item ESPECIFICAMENTE na organização fornecida
      const item = await this.searchItemInOrganization(client, itemNumber, organizationCode);

      if (!item) {
        this.logger.warn(`❌ Item ${itemNumber} NÃO está associado à organização ${organizationCode}`);
        return null;
      }

      this.logger.log(`✅ Item ${itemNumber} encontrado na organização ${organizationCode} (ItemId: ${item.ItemId})`);
      
      this.logger.log(`📦 Dados completos do item do Fusion: ${JSON.stringify({
        ItemNumber: item.ItemNumber,
        ItemDescription: item.ItemDescription,
        Description: item.Description,
        ItemId: item.ItemId,
        PrimaryUOMCode: item.PrimaryUOMCode,
        PrimaryUnitOfMeasure: item.PrimaryUnitOfMeasure,
        PrimaryUOMValue: item.PrimaryUOMValue,
        OrganizationCode: item.OrganizationCode,
      }, null, 2)}`);
      
      // IMPORTANTE: O Fusion retorna ItemDescription (não Description)
      // Exemplo: "PREMIACAO CONSULTOR (HOUSE)"
      const itemDescription = item.ItemDescription || item.Description || item.ItemNumber;
      
      return {
        ItemId: item.ItemId,
        ItemNumber: item.ItemNumber,
        Description: itemDescription, // Usar ItemDescription do Fusion
        PrimaryUOM: item.PrimaryUOMCode || item.PrimaryUOMValue || item.PrimaryUnitOfMeasure || 'UN', // Fallback para 'UN'
        OrganizationId: item.OrganizationId,
        OrganizationCode: item.OrganizationCode,
      };

    } catch (error) {
      this.logger.error(`Erro ao buscar item ${itemNumber} na organização ${organizationCode}: ${error.message}`);
      
      // Se o item não foi encontrado, retornar null ao invés de lançar exceção
      if (error.response?.status === 404) {
        return null;
      }

      // Para outros erros, lançar exceção
      throw error;
    }
  }

  /**
   * Busca item em uma organização específica (método auxiliar)
   * 
   * @param client Axios client configurado
   * @param itemNumber Número do item
   * @param organizationCode Código da organização (opcional)
   * @returns Item encontrado ou null
   */
  private async searchItemInOrganization(
    client: any,
    itemNumber: string,
    organizationCode?: string,
  ): Promise<any> {
    try {
      // Construir query Oracle REST (usar ; ao invés de AND)
      let query = `ItemNumber='${itemNumber}'`;
      if (organizationCode) {
        query += `;OrganizationCode='${organizationCode}'`;
      }

      const response = await client.get('/itemsV2', {
        params: { 
          q: query,
          limit: 1,
          orderBy: 'OrganizationCode', // Ordenar para ser determinístico
        },
      });

      const items = response.data.items || [];
      
      if (items.length === 0) {
        return null;
      }

      return items[0];

    } catch (error) {
      // Se erro 404, retornar null silenciosamente
      if (error.response?.status === 404) {
        return null;
      }
      // Para outros erros, propagar
      throw error;
    }
  }

  /**
   * Busca múltiplos itens por números em uma organização específica
   * 
   * @param itemNumbers Array de números de itens
   * @param organizationCode Código da organização (obrigatório)
   * @returns Array de itens encontrados (apenas os que estão associados à organização)
   */
  async findItemsByNumbers(itemNumbers: string[], organizationCode: string): Promise<any[]> {
    this.logger.log(`Buscando ${itemNumbers.length} itens na organização ${organizationCode}`);

    const results = await Promise.allSettled(
      itemNumbers.map(itemNumber => this.findItemByNumber(itemNumber, organizationCode))
    );

    const items = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => (result as PromiseFulfilledResult<any>).value);

    const notFound = itemNumbers.length - items.length;
    if (notFound > 0) {
      this.logger.warn(`⚠️ ${notFound} item(ns) não encontrado(s) ou não associado(s) à organização ${organizationCode}`);
    }

    this.logger.log(`✅ Itens encontrados e associados: ${items.length}/${itemNumbers.length}`);
    
    return items;
  }
}

