import { Controller, Post, Body, Get, Param, Query, HttpException, HttpStatus, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PurchaseRequisitionService } from './services/purchase-requisition.service';
import { CreatePurchaseRequisitionDto } from './dto/create-purchase-requisition.dto';
import * as XLSX from 'xlsx';
import * as csv from 'csv-parser';
import { createReadStream, unlinkSync } from 'fs';

/**
 * Controller para Purchase Requisitions (Requisições de Compras)
 * 
 * Endpoints de produção para criar e gerenciar requisições de compras no Oracle Fusion
 */
@ApiTags('procurement/purchase-requisitions')
@Controller('procurement/purchase-requisitions')
export class ProcurementController {
  constructor(
    private readonly purchaseRequisitionService: PurchaseRequisitionService,
  ) {}

  /**
   * Cria uma nova Purchase Requisition
   * 
   * POST /api/procurement/purchase-requisitions
   * 
   * @param dto Dados da requisição de compras
   * @returns Purchase Requisition criada
   */
  @Post()
  @ApiOperation({ summary: 'Criar Purchase Requisition' })
  @ApiResponse({ status: 201, description: 'Requisição criada com sucesso' })
  @ApiBody({
    description: 'Exemplo de payload para criar uma Purchase Requisition',
    schema: {
      type: 'object',
      properties: {
        businessUnit: { type: 'string', example: 'V30326 TRINITA' },
        requesterEmail: { type: 'string', example: 'camila.americo@bild.com.br' },
        itemNumber: { type: 'string', example: 'SVA20035' },
        quantity: { type: 'number', example: 1 },
        price: { type: 'string', example: '12400.40' },
        ticket: { type: 'string', example: 'ZEEV-001' },
        accountNumber: { type: 'string', example: '32102040021' },
        costCenter: { type: 'string', example: 'CC0091' },
        project: { type: 'string', example: 'PV0508' },
        financialClass: { type: 'string', example: 'CF001' },
        supplierCode: { type: 'number', example: 65007 },
        supplierCNPJ: { type: 'string', example: '31303450000187' },
        supplierName: { type: 'string', example: 'FORNECEDOR LTDA' },
        supplierSite: { type: 'string', example: '31303450000187' },
        description: { type: 'string', example: 'Descrição customizada do item' },
        needByDate: { type: 'string', example: '2025-11-30' },
        uom: { type: 'string', example: 'UN' },
        autoSubmit: { type: 'boolean', example: true }
      },
      required: ['businessUnit', 'requesterEmail', 'itemNumber', 'quantity', 'price', 'accountNumber', 'costCenter', 'project']
    }
  })
  async createPurchaseRequisition(@Body() dto: CreatePurchaseRequisitionDto) {
    try {
      const result = await this.purchaseRequisitionService.createPurchaseRequisition(dto);
      
      return {
        success: true,
        message: 'Purchase Requisition criada com sucesso',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          details: error.response || null,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Busca uma Purchase Requisition por ID
   * 
   * GET /api/procurement/purchase-requisitions/:id
   * 
   * @param id ID da Purchase Requisition
   * @returns Purchase Requisition encontrada
   */
  @Get(':id')
  async getPurchaseRequisition(@Param('id') id: string) {
    try {
      const requisitionId = parseInt(id, 10);
      const result = await this.purchaseRequisitionService.getPurchaseRequisition(requisitionId);
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lista Purchase Requisitions
   * 
   * GET /api/procurement/purchase-requisitions?limit=10&offset=0
   * 
   * @param limit Número máximo de resultados
   * @param offset Deslocamento para paginação
   * @returns Lista de Purchase Requisitions
   */
  @Get()
  async listPurchaseRequisitions(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    try {
      const limitNumber = limit ? parseInt(limit, 10) : 25;
      const offsetNumber = offset ? parseInt(offset, 10) : 0;
      
      const result = await this.purchaseRequisitionService.listPurchaseRequisitions(
        limitNumber,
        offsetNumber,
      );
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Submete uma Purchase Requisition para aprovação
   * 
   * POST /api/procurement/purchase-requisitions/:id/submit
   * 
   * @param id ID da Purchase Requisition (RequisitionHeaderId)
   * @returns Resultado da submissão
   */
  @Post(':id/submit')
  async submitPurchaseRequisition(@Param('id') id: string) {
    try {
      const result = await this.purchaseRequisitionService.submitPurchaseRequisition(id);
      
      return {
        success: true,
        message: 'Purchase Requisition submetida para aprovação com sucesso',
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          details: error.response || null,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Upload de arquivo (Excel ou CSV) para criar múltiplas requisições em lote
   * 
   * POST /api/procurement/purchase-requisitions/upload
   * 
   * @param file Arquivo Excel (.xlsx) ou CSV (.csv)
   * @returns Resultado do processamento em lote
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `requisitions-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        const allowedExtensions = ['.csv', '.xlsx', '.xls'];
        const ext = extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
          callback(null, true);
        } else {
          callback(new Error(`Formato não suportado: ${ext}. Use .csv, .xlsx ou .xls`), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new HttpException(
        { success: false, error: 'Nenhum arquivo foi enviado' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      // Processar arquivo
      const requisitions = await this.parseFile(file);
      
      if (requisitions.length === 0) {
        throw new HttpException(
          { success: false, error: 'Nenhuma requisição válida encontrada no arquivo' },
          HttpStatus.BAD_REQUEST,
        );
      }

      // Processar cada requisição
      const results: any[] = [];
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < requisitions.length; i++) {
        const reqDto = requisitions[i];
        
        try {
          const result = await this.purchaseRequisitionService.createPurchaseRequisition(reqDto);
          
          results.push({
            line: i + 2, // +2 porque linha 1 é header e array começa em 0
            ticket: reqDto.ticket,
            success: true,
            requisitionNumber: result.requisition.requisitionNumber,
            requisitionId: result.requisition.requisitionId,
            status: result.requisition.status,
          });
          successCount++;
        } catch (error: any) {
          results.push({
            line: i + 2,
            ticket: reqDto.ticket,
            success: false,
            error: error.message || 'Erro desconhecido',
          });
          errorCount++;
        }
      }

      return {
        success: true,
        message: errorCount === 0 
          ? 'Arquivo processado com sucesso' 
          : `Arquivo processado com ${errorCount} erro(s)`,
        data: {
          totalProcessed: requisitions.length,
          totalSuccess: successCount,
          totalErrors: errorCount,
          results,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Erro ao processar arquivo',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      // Limpar arquivo temporário
      if (file && file.path) {
        try {
          unlinkSync(file.path);
        } catch (err) {
          // Ignorar erro de limpeza
        }
      }
    }
  }

  /**
   * Parser de arquivo Excel/CSV para CreatePurchaseRequisitionDto
   */
  private async parseFile(file: Express.Multer.File): Promise<CreatePurchaseRequisitionDto[]> {
    const extension = file.originalname.split('.').pop()?.toLowerCase();

    if (extension === 'xlsx' || extension === 'xls') {
      return this.parseExcel(file);
    } else if (extension === 'csv') {
      return this.parseCSV(file);
    } else {
      throw new Error(`Formato de arquivo não suportado: ${extension}. Use .xlsx ou .csv`);
    }
  }

  /**
   * Parser de arquivo Excel
   */
  private parseExcel(file: Express.Multer.File): CreatePurchaseRequisitionDto[] {
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    return rows
      .map((row: any) => this.mapRowToDto(row))
      .filter((dto) => dto !== null) as CreatePurchaseRequisitionDto[];
  }

  /**
   * Parser de arquivo CSV
   */
  private async parseCSV(file: Express.Multer.File): Promise<CreatePurchaseRequisitionDto[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];

      createReadStream(file.path)
        .pipe(csv())
        .on('data', (row) => results.push(row))
        .on('end', () => {
          const dtos = results
            .map((row) => this.mapRowToDto(row))
            .filter((dto) => dto !== null) as CreatePurchaseRequisitionDto[];
          resolve(dtos);
        })
        .on('error', (error) => reject(error));
    });
  }

  /**
   * Mapeia linha do arquivo para CreatePurchaseRequisitionDto
   */
  private mapRowToDto(row: any): CreatePurchaseRequisitionDto | null {
    // Ignorar linhas vazias
    if (!row.businessUnit && !row.business_unit && !row.itemNumber && !row.item_number) {
      return null;
    }

    return {
      businessUnit: row.businessUnit || row.business_unit,
      requesterEmail: row.requesterEmail || row.requester_email,
      itemNumber: row.itemNumber || row.item_number,
      quantity: parseFloat(row.quantity) || 1,
      price: String(row.price).replace(',', '.'),
      ticket: row.ticket,
      accountNumber: row.accountNumber || row.account_number,
      costCenter: row.costCenter || row.cost_center,
      project: row.project,
      financialClass: row.financialClass || row.financial_class,
      supplierCode: row.supplierCode ? parseInt(row.supplierCode) : undefined,
      supplierCNPJ: row.supplierCNPJ || row.supplier_cnpj,
      supplierName: row.supplierName || row.supplier_name,
      supplierSite: row.supplierSite || row.supplier_site,
      description: row.description,
      needByDate: row.needByDate || row.need_by_date,
      uom: row.uom,
      autoSubmit: true, // Sempre submeter automaticamente em lote
    };
  }
}


