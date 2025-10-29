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
    this.baseUrl = this.configService.get<string>('FUSION_BASE_URL') || 'https://fa-evvi-test-saasfaprod1.fa.ocs.oraclecloud.com';
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

  async submitRequisition(requisitionId: string): Promise<any> {
    const startTime = Date.now();

    try {
      this.logger.log(`Submitting requisition ${requisitionId} to Fusion`);
      
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

  async testConnection(): Promise<boolean> {
    try {
      this.logger.log('=== TESTING FUSION CONNECTION ===');
      this.logger.log(`Base URL: ${this.baseUrl}`);
      this.logger.log(`Version: ${this.version}`);
      
      const http = await this.client();
      const testUrl = '/purchaseRequisitions?limit=1';
      const fullTestUrl = `${this.baseUrl}/fscmRestApi/resources/${this.version}${testUrl}`;
      
      this.logger.log(`Testing URL: ${fullTestUrl}`);
      this.logger.log(`Authorization Header: ${this.auth.getBasicAuthHeader()}`);
      
      const response = await http.get(testUrl);
      this.logger.log(`Response Status: ${response.status}`);
      this.logger.log('Fusion connection test successful');
      return true;
    } catch (error) {
      this.logger.error('=== FUSION CONNECTION TEST FAILED ===');
      this.logger.error(`Error Message: ${error.message}`);
      this.logger.error(`Error Code: ${error.code}`);
      this.logger.error(`Error Status: ${error.response?.status}`);
      this.logger.error(`Error Data: ${JSON.stringify(error.response?.data)}`);
      return false;
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
