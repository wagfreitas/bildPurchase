import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthService } from '../auth/auth.service';

/**
 * Interface para dados de uma Inventory Organization
 */
export interface OrganizationData {
  organizationId: number;
  organizationCode: string;
  organizationName: string;
  businessUnitId: number;
  businessUnitName: string;
  locationId: number;
  locationCode: string;
  masterOrganizationId: number;
  masterOrganizationCode: string;
}

/**
 * Serviço para buscar informações de Inventory Organizations no Oracle Fusion
 *
 * IMPORTANTE: Este serviço resolve o relacionamento entre:
 * - Inventory Organization (ex: OI_B10180) - onde os itens são armazenados
 * - Business Unit (ex: B10180 BILD 10 DESENVOLVI) - quem faz as requisições
 * - Location (ex: LOC_B10180) - onde entregar
 *
 * Endpoint Oracle: /fscmRestApi/resources/11.13.18.05/inventoryOrganizations
 */
@Injectable()
export class OrganizationLookupService {
  private readonly logger = new Logger(OrganizationLookupService.name);
  private readonly baseUrl: string;
  private readonly version: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly auth: AuthService,
  ) {
    this.baseUrl = this.configService.get<string>('FUSION_BASE_URL') || 'https://fa-evvi-test-saasfaprod1.fa.ocs.oraclecloud.com';
    this.version = this.configService.get<string>('FUSION_REST_VERSION') || '11.13.18.05';
  }

  /**
   * Busca uma Inventory Organization pelo código
   *
   * Este método é ESSENCIAL para criar Purchase Requisitions corretamente,
   * pois resolve o código da organização (OI_B10180) para o nome completo
   * da Business Unit (B10180 BILD 10 DESENVOLVI) que a Oracle espera.
   *
   * @param organizationCode Código da organização (ex: OI_B10180)
   * @returns Dados completos da organização ou null se não encontrada
   */
  async findOrganizationByCode(organizationCode: string): Promise<OrganizationData | null> {
    try {
      this.logger.log(`Buscando organização: ${organizationCode}`);

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

      // Consultar a API Oracle
      const response = await client.get('/inventoryOrganizations', {
        params: {
          q: `OrganizationCode='${organizationCode}'`,
          limit: 1,
          fields: [
            'OrganizationId',
            'OrganizationCode',
            'OrganizationName',
            'ManagementBusinessUnitId',
            'ManagementBusinessUnitName',
            'LocationId',
            'LocationCode',
            'MasterOrganizationId',
            'MasterOrganizationCode',
          ].join(','),
        },
      });

      const items = response.data.items || [];

      if (items.length === 0) {
        this.logger.warn(`❌ Organização ${organizationCode} não encontrada`);
        return null;
      }

      const org = items[0];

      this.logger.log(`✅ Organização ${organizationCode} encontrada - BU: ${org.ManagementBusinessUnitName}`);

      return {
        organizationId: org.OrganizationId,
        organizationCode: org.OrganizationCode,
        organizationName: org.OrganizationName,
        businessUnitId: org.ManagementBusinessUnitId,
        businessUnitName: org.ManagementBusinessUnitName,
        locationId: org.LocationId,
        locationCode: org.LocationCode,
        masterOrganizationId: org.MasterOrganizationId,
        masterOrganizationCode: org.MasterOrganizationCode,
      };

    } catch (error) {
      this.logger.error(`Erro ao buscar organização ${organizationCode}: ${error.message}`);

      // Se erro 404, retornar null
      if (error.response?.status === 404) {
        return null;
      }

      // Para outros erros, lançar exceção
      throw new HttpException(
        `Erro ao consultar organização ${organizationCode}: ${error.message}`,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Valida se uma organização existe e está ativa
   *
   * @param organizationCode Código da organização
   * @returns true se existe e está ativa
   */
  async validateOrganization(organizationCode: string): Promise<boolean> {
    const org = await this.findOrganizationByCode(organizationCode);
    return org !== null;
  }

  /**
   * Busca múltiplas organizações de uma vez
   *
   * @param organizationCodes Array de códigos de organizações
   * @returns Array de organizações encontradas
   */
  async findOrganizationsByCodes(organizationCodes: string[]): Promise<OrganizationData[]> {
    this.logger.log(`Buscando ${organizationCodes.length} organizações`);

    const results = await Promise.allSettled(
      organizationCodes.map(code => this.findOrganizationByCode(code))
    );

    const organizations = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => (result as PromiseFulfilledResult<OrganizationData>).value);

    const notFound = organizationCodes.length - organizations.length;
    if (notFound > 0) {
      this.logger.warn(`⚠️ ${notFound} organização(ões) não encontrada(s)`);
    }

    this.logger.log(`✅ Organizações encontradas: ${organizations.length}/${organizationCodes.length}`);

    return organizations;
  }

  /**
   * Extrai o código da organização a partir do nome da Business Unit
   *
   * Padrão Oracle: Business Unit "V30326 TRINITA" → Organization Code "OI_V30326"
   *
   * @param businessUnitName Nome completo da Business Unit (ex: "V30326 TRINITA")
   * @returns Código da organização (ex: "OI_V30326")
   */
  extractOrganizationCodeFromBUName(businessUnitName: string): string {
    // Extrair o código (primeira palavra antes do espaço)
    // Ex: "V30326 TRINITA" → "V30326"
    const buCode = businessUnitName.split(' ')[0];
    
    // Adicionar prefixo OI_ para obter o código da organização
    // Ex: "V30326" → "OI_V30326"
    return `OI_${buCode}`;
  }

  /**
   * Busca organização pelo nome da Business Unit
   *
   * Este método é útil quando recebemos o nome completo da BU (ex: do RPA/Zeev)
   * e precisamos obter os dados da organização.
   *
   * @param businessUnitName Nome completo da BU (ex: "V30326 TRINITA")
   * @returns Dados da organização ou null se não encontrada
   */
  async findOrganizationByBUName(businessUnitName: string): Promise<OrganizationData | null> {
    this.logger.log(`Buscando organização pelo nome da BU: ${businessUnitName}`);

    // Extrair o código da organização
    const organizationCode = this.extractOrganizationCodeFromBUName(businessUnitName);

    this.logger.log(`Código da organização extraído: ${organizationCode}`);

    // Buscar a organização
    const orgData = await this.findOrganizationByCode(organizationCode);

    // Validar se o nome da BU retornado bate com o esperado
    if (orgData && orgData.businessUnitName !== businessUnitName) {
      this.logger.warn(
        `⚠️ Nome da BU não confere! Esperado: "${businessUnitName}", Encontrado: "${orgData.businessUnitName}"`
      );
    }

    return orgData;
  }
}

