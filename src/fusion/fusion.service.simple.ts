import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class FusionService {
  private readonly logger = new Logger(FusionService.name);
  private readonly baseUrl = process.env.FUSION_BASE_URL;
  private readonly version = process.env.FUSION_REST_VERSION || '11.13.18.05';

  constructor(
    private readonly auth: AuthService,
  ) {}

  private async client() {
    const authHeader = this.auth.getBasicAuthHeader();
    return axios.create({
      baseURL: `${this.baseUrl}/fscmRestApi/resources/${this.version}`,
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
      this.logger.log(`Creating requisition in Fusion: ${JSON.stringify(payload, null, 2)}`);
      
      const http = await this.client();
      const response = await http.post('/purchaseRequisitions', payload);
      
      const duration = Date.now() - startTime;
      this.logger.log(`Fusion API call: POST /purchaseRequisitions - ${response.status} - ${duration}ms`);

      this.logger.log(`Requisition created successfully: ${response.data.RequisitionNumber || response.data.Id}`);
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data?.detail || error.message;

      this.logger.error(`Fusion API call failed: POST /purchaseRequisitions - ${statusCode} - ${duration}ms - ${errorMessage}`);

      this.logger.error(`Failed to create requisition: ${errorMessage}`);
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
      const endpoint = `/purchaseRequisitions/${encodeURIComponent(requisitionId)}/action/submitRequisition`;
      const response = await http.post(endpoint, {});
      
      const duration = Date.now() - startTime;
      this.logger.log(`Fusion API call: POST ${endpoint} - ${response.status} - ${duration}ms`);

      this.logger.log(`Requisition ${requisitionId} submitted successfully`);
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      const statusCode = error.response?.status || 500;
      const errorMessage = error.response?.data?.detail || error.message;

      this.logger.error(`Fusion API call failed: POST /purchaseRequisitions/${requisitionId}/action/submitRequisition - ${statusCode} - ${duration}ms - ${errorMessage}`);

      this.logger.error(`Failed to submit requisition ${requisitionId}: ${errorMessage}`);
      throw new HttpException(
        `Fusion API error: ${errorMessage}`,
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
      const http = await this.client();
      // Teste simples de conectividade
      await http.get('/purchaseRequisitions?limit=1');
      this.logger.log('Fusion connection test successful');
      return true;
    } catch (error) {
      this.logger.error(`Fusion connection test failed: ${error.message}`);
      return false;
    }
  }
}
