import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthService } from '../auth/auth.service';

/**
 * Serviço para buscar fornecedores (Suppliers) no Oracle Fusion
 * 
 * Endpoint: /fscmRestApi/resources/latest/suppliers
 */
@Injectable()
export class SupplierLookupService {
  private readonly logger = new Logger(SupplierLookupService.name);
  private readonly baseUrl: string;
  private readonly version: string;

  constructor(
    private readonly auth: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('FUSION_BASE_URL') || '';
    this.version = this.configService.get<string>('FUSION_REST_VERSION') || '11.13.18.05';
  }

  /**
   * Busca fornecedor por CNPJ
   * 
   * @param cnpj CNPJ do fornecedor (apenas números)
   * @returns Dados do fornecedor ou null se não encontrado
   */
  async findSupplierByCNPJ(cnpj: string): Promise<{
    SupplierId: number;
    SupplierName: string;
    SupplierNumber: string;
    TaxpayerId: string;
  } | null> {
    // Normalizar CNPJ - remover caracteres especiais e manter apenas números
    const normalizedCNPJ = cnpj.replace(/\D/g, '');
    
    try {
      this.logger.log(`🔍 Buscando fornecedor por CNPJ: ${normalizedCNPJ}`);

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

      // Buscar por TaxpayerId (CNPJ) - campo correto para CNPJ no Oracle Fusion
      const response = await client.get('/suppliers', {
        params: {
          q: `TaxpayerId='${normalizedCNPJ}'`,
          limit: 1,
          fields: 'SupplierId,Supplier,SupplierNumber,TaxpayerId',
        },
      });

      const items = response.data.items || [];
      
      if (items.length > 0) {
        const supplier = items[0];
        const displayName = supplier.Supplier || supplier.SupplierName || 'SEM NOME';
        this.logger.log(`✅ Fornecedor encontrado: ${displayName} (ID: ${supplier.SupplierId}, CNPJ: ${normalizedCNPJ})`);
        return {
          SupplierId: supplier.SupplierId,
          SupplierName: supplier.Supplier || supplier.SupplierName || `CNPJ ${normalizedCNPJ}`,
          SupplierNumber: supplier.SupplierNumber,
          TaxpayerId: supplier.TaxpayerId || normalizedCNPJ,
        };
      }

      this.logger.warn(`⚠️ Fornecedor não encontrado com CNPJ: ${normalizedCNPJ}`);
      return null;

    } catch (error) {
      this.logger.error(`Erro ao buscar fornecedor por CNPJ ${normalizedCNPJ}: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(`📋 Detalhes do erro Oracle: ${JSON.stringify(error.response.data)}`);
      }
      this.logger.warn(`⚠️ Fornecedor não encontrado com CNPJ: ${normalizedCNPJ}`);
      return null;
    }
  }

  /**
   * Busca site do fornecedor por CNPJ ou nome
   * 
   * @param supplierId ID do fornecedor
   * @param searchTerm CNPJ ou nome do site
   * @returns Dados do site ou null
   */
  async findSupplierSite(
    supplierId: number,
    searchTerm: string,
  ): Promise<{
    SupplierSiteId: number;
    SupplierSiteCode: string;
  } | null> {
    try {
      this.logger.log(`🔍 Buscando site do fornecedor ${supplierId}: ${searchTerm}`);

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

      const response = await client.get(`/suppliers/${supplierId}/child/sites`, {
        params: {
          limit: 5,
          fields: 'SupplierSiteId,SupplierSite,ProcurementBU',
        },
      });

      const items = response.data.items || [];
      if (items.length > 0) {
        // Se encontrou apenas um site, usar esse
        if (items.length === 1) {
          this.logger.log(`✅ Site encontrado: ${items[0].SupplierSite} (ID: ${items[0].SupplierSiteId})`);
          return {
            SupplierSiteId: items[0].SupplierSiteId,
            SupplierSiteCode: items[0].SupplierSite,
          };
        }

        // Tentar match por CNPJ/código
        const normalizedSearch = searchTerm.replace(/\D/g, '');
        const match = items.find((site: any) => 
          site.SupplierSite?.includes(normalizedSearch)
        );

        if (match) {
          this.logger.log(`✅ Site encontrado (match): ${match.SupplierSite} (ID: ${match.SupplierSiteId})`);
          return {
            SupplierSiteId: match.SupplierSiteId,
            SupplierSiteCode: match.SupplierSite,
          };
        }

        // Usar o primeiro se não encontrou match
        this.logger.log(`✅ Usando primeiro site: ${items[0].SupplierSite} (ID: ${items[0].SupplierSiteId})`);
        return {
          SupplierSiteId: items[0].SupplierSiteId,
          SupplierSiteCode: items[0].SupplierSite,
        };
      }

      this.logger.warn(`⚠️ Nenhum site encontrado para fornecedor ${supplierId}`);
      return null;

    } catch (error) {
      this.logger.error(`Erro ao buscar site do fornecedor: ${error.message}`);
      if (error.response?.data) {
        this.logger.error(`📋 Detalhes do erro Oracle (site): ${JSON.stringify(error.response.data)}`);
      }
      if (error.response?.status) {
        this.logger.error(`📋 Status HTTP: ${error.response.status}`);
      }
      return null;
    }
  }

  /**
   * Busca fornecedor e site pelo CNPJ
   * 
   * @param supplierName Nome do fornecedor (não usado, mantido por compatibilidade)
   * @param supplierCNPJ CNPJ do fornecedor
   * @returns Dados completos ou null
   */
  async findSupplierAndSite(
    supplierName: string,
    supplierCNPJ: string,
  ): Promise<{
    supplier: {
      SupplierId: number;
      SupplierName: string;
      SupplierNumber: string;
    };
    site?: {
      SupplierSiteId: number;
      SupplierSiteCode: string;
    };
  } | null> {
    try {
      // Buscar fornecedor APENAS por CNPJ (mais confiável)
      const supplier = await this.findSupplierByCNPJ(supplierCNPJ);

      if (!supplier) {
        this.logger.warn(`Fornecedor não encontrado com CNPJ: ${supplierCNPJ}`);
        return null;
      }

      // Buscar site do fornecedor
      const site = await this.findSupplierSite(supplier.SupplierId, supplierCNPJ);

      return {
        supplier,
        site: site || undefined,
      };

    } catch (error) {
      this.logger.error(`Erro ao buscar fornecedor e site: ${error.message}`);
      return null;
    }
  }
}
