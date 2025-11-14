
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
  @ApiOperation({ summary: 'Cria uma requisiçao de compra no Fusion' })
  @ApiResponse({ status: 201, description: 'Requisição criada com sucesso' })
  @ApiResponse({ status: 400, description: 'Requisição inválida' })
  async create(@Body() dto: RequisitionDTO) {
    const header: any = {
      PreparerId: 300000102174657, // ID do preparador (obrigatório)
      RequisitioningBUId: 300000006103506, // ID da Business Unit (obrigatório)
      Description: dto.description || "Requisicao via API",
      TaxationCountryCode: "BR",
    };

  

    const lines = dto.lines.map((l, index) => ({
      LineNumber: index + 1,
      ItemDescription: l.description || l.itemNumber,
      Quantity: l.quantity,
      Price: l.unitPrice,
      CurrencyCode: "BRL",
      DestinationTypeCode: "EXPENSE",
      DestinationOrganizationId: 300000006103506, // Mesmo ID da Business Unit
      
    }));

    const payload = { ...header, lines };

    if (dto.externalReference) {
      try {
        const found = await this.fusion.findRequisitionByExternalRef(dto.externalReference);
        if (Array.isArray(found?.items) && found.items.length > 0) {
          return { duplicated: true, requisitions: found.items };
        }
      } catch {  }
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
  @ApiOperation({ summary: 'Buscar requisicao de compra no Fusion' })
  @ApiParam({ name: 'id', description: 'ID da requisição de compra' })
  @ApiResponse({ status: 200, description: 'Detalhes da requisição de compra' })
  @ApiResponse({ status: 404, description: 'Requisição de compra não encontrada' })
  async getRequisition(@Param('id') id: string) {
    return await this.fusion.getRequisition(id);
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submeter uma requisição de compra para aprovação' })
  @ApiResponse({ status: 200, description: 'Requisição submetida com sucesso' })
  @ApiResponse({ status: 400, description: 'ID da requisição de compra inválido' })
  async submit(@Body() dto: SubmitDTO) {
    const res = await this.fusion.submitRequisition(dto.requisitionId);
    return res;
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Criar múltiplas requisições de compra' })
  @ApiResponse({ status: 200, description: 'Resultados do processamento em lote' })
  @ApiResponse({ status: 400, description: 'Dados da requisição de compra inválidos' })
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
  @ApiOperation({ summary: 'Buscar requisicoes de compra por referencia externa' })
  @ApiResponse({ status: 200, description: 'Busca resultados' })
  async searchByExternalRef(@Body() body: { externalReference: string }) {
    return await this.fusion.findRequisitionByExternalRef(body.externalReference);
  }

}
