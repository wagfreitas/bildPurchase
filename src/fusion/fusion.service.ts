import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class FusionService {
  private readonly logger = new Logger(FusionService.name);
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
    
    this.logger.log(`FusionService initialized with baseUrl: ${this.baseUrl}`);
    this.logger.log(`FusionService initialized with version: ${this.version}`);
  }

  private async client() {
    const authHeader = this.auth.getBasicAuthHeader();
    const fullUrl = `${this.baseUrl}/fscmRestApi/resources/${this.version}`;
    this.logger.log(`Using Fusion URL: ${fullUrl}`);
    return axios.create({
      baseURL: fullUrl,
      headers: { 
        Authorization: authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  async createRequisition(payload: any): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log('=== CREATING REQUISITION ===');
      this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

      const http = await this.client();
      const response = await http.post('/purchaseRequisitions', payload);

      const duration = Date.now() - startTime;
      this.logger.log(`Fusion API call: POST /purchaseRequisitions - ${response.status} - ${duration}ms`);
      this.logger.log(`Response: ${JSON.stringify(response.data, null, 2)}`);

      this.logger.log(`Requisition created successfully: ${response.data.RequisitionNumber || response.data.Id}`);
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data?.detail || error.message;

      this.logger.error('=== REQUISITION CREATION FAILED ===');
      this.logger.error(`Status Code: ${statusCode}`);
      this.logger.error(`Error Message: ${errorMessage}`);
      this.logger.error(`Full Error Response: ${JSON.stringify(error.response?.data, null, 2)}`);
      this.logger.error(`Request URL: ${error.config?.url}`);
      this.logger.error(`Request Method: ${error.config?.method}`);
      this.logger.error(`Duration: ${duration}ms`);

      throw new HttpException(
        `Fusion API error: ${errorMessage}`,
        statusCode,
      );
    }
  }

  /**
   * Deriva a charge account automaticamente usando a action do Fusion
   * Isso força o Fusion a gerar a charge account baseado nas regras de derivação
   */
  async deriveChargeAccount(requisitionId: string): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Deriving charge account for requisition ${requisitionId}`);
      
      const http = await this.client();
      
      // Endpoint para derivar charge account
      const endpoint = `/purchaseRequisitions/${encodeURIComponent(requisitionId)}/action/deriveChargeAccount`;
      
      this.logger.log(`Derive charge account endpoint: ${endpoint}`);
      
      // IMPORTANTE: Para actions, usar Content-Type específico do Oracle
      const response = await http.post(endpoint, {}, {
        headers: {
          'Content-Type': 'application/vnd.oracle.adf.action+json',
          'REST-Framework-Version': '2',
        },
      });
      
      const duration = Date.now() - startTime;
      this.logger.log(`Fusion API call: POST ${endpoint} - ${response.status} - ${duration}ms`);
      this.logger.log(`✅ Charge account derived successfully for requisition ${requisitionId}!`);
      
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data?.detail || error.message;
      const errorData = error.response?.data || null;

      this.logger.error(`=== DERIVE CHARGE ACCOUNT ERROR ===`);
      this.logger.error(`Requisition ID: ${requisitionId}`);
      this.logger.error(`Status Code: ${statusCode}`);
      this.logger.error(`Error Message: ${errorMessage}`);
      this.logger.error(`Full Error Response: ${JSON.stringify(errorData, null, 2)}`);
      this.logger.error(`Duration: ${duration}ms`);
      this.logger.error(`================================`);

      // Não lançar exceção - apenas logar o erro
      // Se a derivação falhar, ainda podemos tentar submeter
      return null;
    }
  }

  async submitRequisition(requisitionId: string): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Submitting requisition ${requisitionId} to Fusion`);
      
      // PRIMEIRO: Tentar derivar a charge account antes de submeter
      this.logger.log(`🔄 Tentando derivar charge account antes da submissão...`);
      await this.deriveChargeAccount(requisitionId);
      
      const http = await this.client();
      
      // Endpoint oficial da documentação Oracle
      const endpoint = `/purchaseRequisitions/${encodeURIComponent(requisitionId)}/action/submitRequisition`;
      
      this.logger.log(`Submission endpoint: ${endpoint}`);
      
      // IMPORTANTE: Para actions, usar Content-Type específico do Oracle
      // application/vnd.oracle.adf.action+json (não application/json)
      const response = await http.post(endpoint, {}, {
        headers: {
          'Content-Type': 'application/vnd.oracle.adf.action+json',
          'REST-Framework-Version': '2',
        },
      });
      
      const duration = Date.now() - startTime;
      this.logger.log(`Fusion API call: POST ${endpoint} - ${response.status} - ${duration}ms`);
      this.logger.log(`✅ Requisition ${requisitionId} submitted successfully!`);
      
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error.response?.status || 500;
      const errorData = error.response?.data;
      const errorMessage = errorData?.detail || errorData?.title || error.message;

      // Log detalhado do erro
      this.logger.error(`=== SUBMISSION ERROR DETAILS ===`);
      this.logger.error(`Requisition ID: ${requisitionId}`);
      this.logger.error(`Status Code: ${statusCode}`);
      this.logger.error(`Error Message: ${errorMessage}`);
      this.logger.error(`Full Error Response: ${JSON.stringify(errorData, null, 2)}`);
      this.logger.error(`Duration: ${duration}ms`);
      this.logger.error(`================================`);

      throw new HttpException(
        {
          message: `Failed to submit requisition: ${errorMessage}`,
          requisitionId,
          statusCode,
          details: errorData,
        },
        statusCode,
      );
    }
  }

  async findRequisitionByExternalRef(externalRef: string): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Searching for requisition with external reference: ${externalRef}`);
      
      const http = await this.client();
      const dffField = process.env.EXTERNAL_REF_FIELD || 'ExternalReference';
      const query = `${dffField}='${externalRef}'`;
      
      const response = await http.get('/purchaseRequisitions', {
        params: { q: query },
      });
      
      const duration = Date.now() - startTime;
      this.logger.log(`Fusion API call: GET /purchaseRequisitions - ${response.status} - ${duration}ms`);

      this.logger.log(`Found ${response.data.items?.length || 0} requisitions with external reference ${externalRef}`);
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data?.detail || error.message;

      this.logger.error(`Fusion API call failed: GET /purchaseRequisitions - ${statusCode} - ${duration}ms - ${errorMessage}`);

      this.logger.warn(`Could not search for requisition with external reference ${externalRef}: ${errorMessage}`);
      throw new HttpException(
        `Fusion API error: ${errorMessage}`,
        statusCode,
      );
    }
  }

  async getRequisition(requisitionId: string): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Getting requisition details: ${requisitionId}`);
      
      const http = await this.client();
      const response = await http.get(`/purchaseRequisitions/${encodeURIComponent(requisitionId)}`);
      
      const duration = Date.now() - startTime;
      this.logger.log(`Fusion API call: GET /purchaseRequisitions/${requisitionId} - ${response.status} - ${duration}ms`);

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data?.detail || error.message;

      this.logger.error(`Fusion API call failed: GET /purchaseRequisitions/${requisitionId} - ${statusCode} - ${duration}ms - ${errorMessage}`);

      this.logger.error(`Failed to get requisition ${requisitionId}: ${errorMessage}`);
      throw new HttpException(
        `Fusion API error: ${errorMessage}`,
        statusCode,
      );
    }
  }


  /**
   * Obtém o schema (describe) dos Descriptive Flexfields (DFF) de uma distribuição
   * Retorna os nomes técnicos dos campos DFF disponíveis
   */
  async describeDistributionDFF(
    requisitionId: string,
    lineId: string,
    distributionId: string,
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      this.logger.log(`📖 Obtendo schema de DFF da distribuição ${distributionId}`);
      
      const http = await this.client();
      const endpoint = `/purchaseRequisitions/${encodeURIComponent(requisitionId)}/child/lines/${encodeURIComponent(lineId)}/child/distributions/${encodeURIComponent(distributionId)}/child/DFF/describe`;
      
      this.logger.log(`GET endpoint: ${endpoint}`);
      
      const response = await http.get(endpoint, {
        headers: {
          'REST-Framework-Version': '2',
          'Accept': 'application/json',
        },
      });
      
      const duration = Date.now() - startTime;
      this.logger.log(`Fusion API call: GET ${endpoint} - ${response.status} - ${duration}ms`);
      this.logger.log(`✅ Schema de DFF obtido com sucesso!`);
      
      return response.data;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error.response?.status || 500;
      const errorMessage = error.message || 'Unknown error';
      const errorData = error.response?.data || null;
      
      this.logger.error(`=== DESCRIBE DFF ERROR ===`);
      this.logger.error(`Distribution ID: ${distributionId}`);
      this.logger.error(`Status Code: ${statusCode}`);
      this.logger.error(`Error Message: ${errorMessage}`);
      this.logger.error(`Error Data: ${JSON.stringify(errorData, null, 2)}`);
      this.logger.error(`Duration: ${duration}ms`);
      this.logger.error(`==========================`);
      
      throw new HttpException(
        {
          message: `Failed to describe distribution DFF: ${errorMessage}`,
          distributionId,
          statusCode,
          details: errorData,
        },
        statusCode,
      );
    }
  }

  /**
   * Busca CodeCombinationId usando os segmentos do ChargeAccount
   * O Fusion pode exigir CodeCombinationId ao invés de segmentos individuais
   */
  async findCodeCombinationId(chargeAccount: string): Promise<number | null> {
    try {
      this.logger.log(`Buscando CodeCombinationId para: ${chargeAccount}`);

      const segments = chargeAccount.split('.');
      if (segments.length < 8) {
        this.logger.warn(`ChargeAccount inválido - deve ter 8 segmentos: ${chargeAccount}`);
        return null;
      }

      const http = await this.client();
      
      // Construir query para buscar a combinação de segmentos
      const queryParts: string[] = [];
      for (let i = 0; i < segments.length; i++) {
        queryParts.push(`Segment${i + 1}='${segments[i]}'`);
      }
      const query = queryParts.join(';');

      this.logger.log(`Query codeCombinations: ${query}`);

      const response = await http.get('/codeCombinations', {
        params: {
          q: query,
          limit: 1,
        },
      });

      const items = response.data.items || [];

      if (items.length === 0) {
        this.logger.warn(`❌ CodeCombination não encontrada para: ${chargeAccount}`);
        return null;
      }

      const codeCombinationId = items[0].CodeCombinationId;
      this.logger.log(`✅ CodeCombinationId encontrado: ${codeCombinationId} para ${chargeAccount}`);

      return codeCombinationId;

    } catch (error) {
      this.logger.error(`Erro ao buscar CodeCombinationId: ${error.message}`);
      
      if (error.response?.status === 404) {
        return null;
      }

      // Não lançar exceção - apenas retornar null
      return null;
    }
  }

  /**
   * Atualiza a distribuição com ChargeAccount usando CodeCombinationId ou segmentos individuais
   * 
   * ESTRATÉGIA:
   * 1. Primeiro tenta buscar CodeCombinationId usando a API de codeCombinations
   * 2. Se encontrar, usa CodeCombinationId para atualizar
   * 3. Se não encontrar, tenta usar segmentos individuais (Segment1-Segment8)
   * 4. Se ainda falhar, tenta usar ChargeAccount como string
   */
  async updateDistributionChargeAccount(
    requisitionId: string,
    lineId: string,
    distributionId: string,
    chargeAccount: string,
  ): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Atualizando ChargeAccount da distribuição ${distributionId}: ${chargeAccount}`);

      const segments = chargeAccount.split('.');
      if (segments.length < 8) {
        throw new Error(`ChargeAccount deve ter 8 segmentos, recebido: ${segments.length}`);
      }

      const http = await this.client();
      const endpoint = `/purchaseRequisitions/${encodeURIComponent(requisitionId)}/child/lines/${encodeURIComponent(lineId)}/child/distributions/${encodeURIComponent(distributionId)}`;

      // ESTRATÉGIA: Tentar usar ChargeAccount como string diretamente
      // O Fusion pode aceitar ChargeAccount como string no PATCH
      // Se não funcionar, tentaremos CodeCombinationId
      let payload: any;
      
      // Primeiro, tentar buscar CodeCombinationId
      let codeCombinationId = await this.findCodeCombinationId(chargeAccount);
      
      if (codeCombinationId) {
        // Usar CodeCombinationId se encontrado
        this.logger.log(`Usando CodeCombinationId: ${codeCombinationId}`);
        payload = {
          CodeCombinationId: codeCombinationId,
        };
      } else {
        // Fallback: Usar ChargeAccount como string
        // O Fusion pode aceitar o ChargeAccount como string concatenada
        this.logger.log(`CodeCombinationId não encontrado, usando ChargeAccount como string`);
        payload = {
          ChargeAccount: chargeAccount,
        };
      }

      this.logger.log(`PATCH endpoint: ${endpoint}`);
      this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

      const response = await http.patch(endpoint, payload, {
        headers: {
          'REST-Framework-Version': '2',
          'Content-Type': 'application/json',
        },
      });

      const duration = Date.now() - startTime;
      this.logger.log(`Fusion API call: PATCH ${endpoint} - ${response.status} - ${duration}ms`);
      this.logger.log(`✅ ChargeAccount atualizado com sucesso!`);

      return response.data;

    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data?.detail || error.message;
      const errorData = error.response?.data || null;

      this.logger.error(`=== UPDATE CHARGE ACCOUNT ERROR ===`);
      this.logger.error(`Distribution ID: ${distributionId}`);
      this.logger.error(`Status Code: ${statusCode}`);
      this.logger.error(`Error Message: ${errorMessage}`);
      this.logger.error(`Full Error Response: ${JSON.stringify(errorData, null, 2)}`);
      this.logger.error(`Duration: ${duration}ms`);
      this.logger.error(`================================`);

      throw new HttpException(
        {
          message: `Failed to update distribution charge account: ${errorMessage}`,
          distributionId,
          statusCode,
          details: errorData,
        },
        statusCode,
      );
    }
  }

  /**
   * Atualiza DFF (Descriptive Flexfields) de uma distribuição
   * para preencher Centro de Custo, Projeto e Classe Financeira em "Additional Information"
   * 
   * Usa o child resource /child/DFF conforme documentação Oracle
   */
  async updateDistributionDFF(
    requisitionId: string,
    lineId: string,
    distributionId: string,
    costCenter: string,
    project: string,
    financialClass?: string,
  ): Promise<any> {
    const startTime = Date.now();
    
    try {
      const logFields = [`CC: ${costCenter}`, `Projeto: ${project}`];
      if (financialClass) {
        logFields.push(`Classe Financeira: ${financialClass}`);
      }
      this.logger.log(`Atualizando DFF da distribuição ${distributionId} - ${logFields.join(', ')}`);
      
      const http = await this.client();
      // Usar child resource /child/DFF para atualizar Descriptive Flexfields
      const endpoint = `/purchaseRequisitions/${encodeURIComponent(requisitionId)}/child/lines/${encodeURIComponent(lineId)}/child/distributions/${encodeURIComponent(distributionId)}/child/DFF`;
      
      // Estrutura de DFF conforme DESCRIBE do tenant Oracle
      // Nomes técnicos obtidos via .../child/DFF/describe:
      // - centroDeCusto (camelCase, minúscula no início)
      // - projeto (camelCase, minúscula no início)
      // - classeFinanceira (camelCase, minúscula no início) - opcional
      // - DistributionId (obrigatório)
      const dffPayload: any = {
        DistributionId: distributionId,
        centroDeCusto: costCenter,
        projeto: project,
      };
      
      // Incluir classe financeira apenas se fornecida
      if (financialClass) {
        dffPayload.classeFinanceira = financialClass;
      }
      
      this.logger.log(`POST endpoint: ${endpoint}`);
      this.logger.log(`Payload DFF: ${JSON.stringify(dffPayload)}`);
      
      const response = await http.post(endpoint, dffPayload);
      
      const duration = Date.now() - startTime;
      this.logger.log(`Fusion API call: POST ${endpoint} - ${response.status} - ${duration}ms`);
      this.logger.log(`✅ DFF atualizado com sucesso!`);
      
      return response.data;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error.response?.status || 500;
      const errorMessage = error.message || 'Unknown error';
      const errorData = error.response?.data || null;
      
      this.logger.error(`=== UPDATE DFF ERROR ===`);
      this.logger.error(`Distribution ID: ${distributionId}`);
      this.logger.error(`Status Code: ${statusCode}`);
      this.logger.error(`Error Message: ${errorMessage}`);
      this.logger.error(`Error Data: ${JSON.stringify(errorData, null, 2)}`);
      this.logger.error(`Duration: ${duration}ms`);
      this.logger.error(`========================`);
      
      throw new HttpException(
        {
          message: `Failed to update distribution DFF: ${errorMessage}`,
          distributionId,
          statusCode,
          details: errorData,
        },
        statusCode,
      );
    }
  }
}
