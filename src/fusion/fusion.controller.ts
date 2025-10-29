
import { Body, Controller, Get, Param, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiExcludeController } from '@nestjs/swagger';
import { FusionService } from './fusion.service';
import { RequisitionDTO, SubmitDTO } from './dto/requisition.dto';

@ApiTags('requisitions')
@ApiExcludeController() // Ocultar do Swagger - usar /procurement/purchase-requisitions
@Controller('requisitions')
export class FusionController {
  constructor(private readonly fusion: FusionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a single requisition (legacy endpoint)' })
  @ApiResponse({ status: 201, description: 'Requisition created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid requisition data' })
  async create(@Body() dto: RequisitionDTO) {
    const header: any = {
      PreparerId: 300000102174657, // ID do preparador (obrigatório)
      RequisitioningBUId: 300000006103506, // ID da Business Unit (obrigatório)
      Description: dto.description || "Requisicao via API",
      TaxationCountryCode: "BR",
    };

    // ExternalReference não é suportado no header principal
    // TODO: Implementar via DFF (Dynamic Flex Fields) se necessário
    // if (dto.externalReference) {
    //   const dffField = process.env.EXTERNAL_REF_FIELD || 'ExternalReference';
    //   header[dffField] = dto.externalReference;
    // }

    const lines = dto.lines.map((l, index) => ({
      LineNumber: index + 1,
      ItemDescription: l.description || l.itemNumber,
      Quantity: l.quantity,
      Price: l.unitPrice,
      CurrencyCode: "BRL",
      DestinationTypeCode: "EXPENSE",
      DestinationOrganizationId: 300000006103506, // Mesmo ID da Business Unit
      // Removido DeliverToLocationCode que pode não existir no sistema
    }));

    const payload = { ...header, lines };

    if (dto.externalReference) {
      try {
        const found = await this.fusion.findRequisitionByExternalRef(dto.externalReference);
        if (Array.isArray(found?.items) && found.items.length > 0) {
          return { duplicated: true, requisitions: found.items };
        }
      } catch { /* se a consulta não for suportada no seu ambiente, seguimos criando */ }
    }

    const created = await this.fusion.createRequisition(payload);

    if (dto.submit && (created?.RequisitionHeaderId || created?.Id || created?.id)) {
      const id = String(created.RequisitionHeaderId || created.Id || created.id);
      try {
        await this.fusion.submitRequisition(id);
        created._submitted = true;
      } catch (e: any) {
        created._submitted = false;
        created._submitError = e?.message || 'submit failed';
      }
    }

    return created;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get requisition details by ID' })
  @ApiParam({ name: 'id', description: 'Fusion Requisition ID' })
  @ApiResponse({ status: 200, description: 'Requisition details' })
  @ApiResponse({ status: 404, description: 'Requisition not found' })
  async getRequisition(@Param('id') id: string) {
    return await this.fusion.getRequisition(id);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit a requisition for approval' })
  @ApiResponse({ status: 200, description: 'Requisition submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid requisition ID' })
  async submit(@Body() dto: SubmitDTO) {
    const res = await this.fusion.submitRequisition(dto.requisitionId);
    return res;
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Create multiple requisitions (synchronous processing)' })
  @ApiResponse({ status: 200, description: 'Bulk processing results' })
  @ApiResponse({ status: 400, description: 'Invalid requisition data' })
  async bulk(@Body() items: RequisitionDTO[]) {
    const results: any[] = [];
    for (const dto of items) {
      try {
        const r = await this.create(dto);
        results.push({ 
          ok: true, 
          data: r,
          externalReference: dto.externalReference,
          businessUnit: dto.businessUnit 
        });
      } catch (e: any) {
        results.push({ 
          ok: false, 
          error: e?.message || 'failed',
          externalReference: dto.externalReference,
          businessUnit: dto.businessUnit 
        });
      }
    }
    return { 
      total: items.length, 
      successful: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results 
    };
  }

  @Post('search')
  @ApiOperation({ summary: 'Search requisitions by external reference' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchByExternalRef(@Body() body: { externalReference: string }) {
    return await this.fusion.findRequisitionByExternalRef(body.externalReference);
  }

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test Fusion API connection' })
  @ApiResponse({ status: 200, description: 'Connection test result' })
  async testConnection() {
    const isConnected = await this.fusion.testConnection();
    return { 
      connected: isConnected,
      message: isConnected ? 'Connection successful' : 'Connection failed'
    };
  }

  @Get('debug')
  @ApiOperation({ summary: 'Debug configuration' })
  debug() {
    return {
      baseUrl: process.env.FUSION_BASE_URL,
      version: process.env.FUSION_REST_VERSION,
      allEnv: Object.keys(process.env).filter(key => key.includes('FUSION'))
    };
  }

  @Post('test-payload')
  @ApiOperation({ summary: 'Test different payload structures' })
  async testPayload(@Body() body: { payload: any }) {
    try {
      const result = await this.fusion.createRequisition(body.payload);
      return { success: true, result };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message,
        statusCode: error.status || 500
      };
    }
  }

  @Post('describe-dff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get DFF schema for a distribution' })
  @ApiResponse({ status: 200, description: 'DFF schema retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid parameters' })
  async describeDFF(@Body() body: { requisitionId: string; lineId: string; distributionId: string }) {
    try {
      const schema = await this.fusion.describeDistributionDFF(
        body.requisitionId,
        body.lineId,
        body.distributionId
      );
      return { success: true, schema };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message,
        statusCode: error.status || 500,
        details: error.response?.details || null
      };
    }
  }
}
