import { Controller, Post, Body, Get, Param, Query, HttpException, HttpStatus, UploadedFile, UseInterceptors, Logger } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { PurchaseRequisitionService } from './services/purchase-requisition.service';
import { CreatePurchaseRequisitionDto } from './dto/create-purchase-requisition.dto';
import * as XLSX from 'xlsx';
import * as csv from 'csv-parser';
import { Readable } from 'stream';

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
      storage: memoryStorage(),
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
    const logger = new Logger(ProcurementController.name);
    
    if (!file) {
      logger.error('Upload falhou: nenhum arquivo foi enviado');
      throw new HttpException(
        { success: false, error: 'Nenhum arquivo foi enviado' },
        HttpStatus.BAD_REQUEST,
      );
    }

    logger.log(`Iniciando processamento de arquivo: ${file.originalname} (${file.size} bytes)`);

    try {
      // Processar arquivo
      const requisitions = await this.parseFile(file);
      
      logger.log(`Arquivo processado: ${requisitions.length} requisições encontradas`);
      
      if (requisitions.length === 0) {
        logger.warn('Nenhuma requisição válida encontrada no arquivo');
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
      const logger = new Logger(ProcurementController.name);
      logger.error(`Erro ao processar arquivo: ${error.message}`, error.stack);
      
      throw new HttpException(
        {
          success: false,
          error: error.message || 'Erro ao processar arquivo',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        },
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Parser de arquivo Excel/CSV para CreatePurchaseRequisitionDto
   */
  private async parseFile(file: Express.Multer.File): Promise<CreatePurchaseRequisitionDto[]> {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    const batchId = Date.now().toString();

    if (extension === 'xlsx' || extension === 'xls') {
      return this.parseExcel(file, batchId);
    } else if (extension === 'csv') {
      return this.parseCSV(file, batchId);
    } else {
      throw new Error(`Formato de arquivo não suportado: ${extension}. Use .xlsx ou .csv`);
    }
  }

  /**
   * Parser de arquivo Excel
   */
  private parseExcel(file: Express.Multer.File, batchId: string): CreatePurchaseRequisitionDto[] {
    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    return rows
      .map((row: any, index: number) => this.mapRowToDto(row, index, batchId))
      .filter((dto) => dto !== null) as CreatePurchaseRequisitionDto[];
  }

  /**
   * Parser de arquivo CSV
   */
  private async parseCSV(file: Express.Multer.File, batchId: string): Promise<CreatePurchaseRequisitionDto[]> {
    return new Promise((resolve, reject) => {
      const logger = new Logger(ProcurementController.name);
      const results: any[] = [];
      const separator = this.detectCsvSeparator(file.buffer);

      logger.log(`Parsing CSV com separador: "${separator}"`);

      const stream = Readable.from(file.buffer);
      stream
        .pipe(csv({
          separator,
          mapHeaders: ({ header }) => {
            // Normalizar header: remover aspas, trim, e normalizar encoding
            const normalized = header
              ?.replace(/^["']|["']$/g, '') // Remove aspas no início/fim
              .trim()
              .normalize('NFD') // Normaliza caracteres especiais
              .replace(/[\u0300-\u036f]/g, ''); // Remove acentos
            return normalized || header?.trim();
          },
        }))
        .on('data', (row) => {
          logger.log(`Linha CSV recebida - Headers: ${Object.keys(row).join(', ')}`);
          logger.log(`Valores: ${JSON.stringify(row).substring(0, 200)}`);
          results.push(row);
        })
        .on('end', () => {
          logger.log(`Total de linhas CSV parseadas: ${results.length}`);
          const dtos = results
            .map((row, index) => {
              logger.log(`Processando linha ${index + 1} - Headers: ${Object.keys(row).join(', ')}`);
              return this.mapRowToDto(row, index, batchId);
            })
            .filter((dto) => dto !== null) as CreatePurchaseRequisitionDto[];
          logger.log(`Total de DTOs válidos: ${dtos.length}`);
          resolve(dtos);
        })
        .on('error', (error) => {
          logger.error(`Erro ao parsear CSV: ${error.message}`, error.stack);
          reject(error);
        });
    });
  }

  /**
   * Mapeia linha do arquivo para CreatePurchaseRequisitionDto
   */
  private mapRowToDto(row: any, index: number, batchId: string): CreatePurchaseRequisitionDto | null {
    const logger = new Logger(ProcurementController.name);
    logger.log(`Normalizando linha ${index + 1} - Headers originais: ${Object.keys(row).join(', ')}`);
    
    const normalized = this.normalizeRow(row);
    
    logger.log(`Após normalização - Campos: ${Object.keys(normalized).join(', ')}`);
    logger.log(`businessUnit: ${normalized.businessUnit}, itemNumber: ${normalized.itemNumber}`);

    // Ignorar linhas vazias
    if (!normalized.businessUnit && !normalized.itemNumber) {
      logger.warn(`Linha ${index + 1} ignorada: sem businessUnit e sem itemNumber`);
      return null;
    }
    
    if (!normalized.businessUnit) {
      logger.error(`Linha ${index + 1}: businessUnit está undefined! Headers originais: ${JSON.stringify(Object.keys(row))}`);
    }

    const price = this.normalizePrice(normalized.price);
    const quantity = this.parseNumber(normalized.quantity) || 1;
    const supplierCode = this.parseNumber(normalized.supplierCode);
    const requesterEmail = this.resolveRequesterEmail(normalized.requesterEmail, normalized.requester);
    const ticket = this.resolveTicket(normalized.ticket, normalized.requesterEmail, normalized.requester, normalized.itemNumber, batchId, index);

    return {
      businessUnit: normalized.businessUnit,
      deliveryLocation: normalized.deliveryLocation,
      requesterEmail,
      requester: normalized.requester,
      itemNumber: normalized.itemNumber,
      quantity,
      price,
      ticket,
      accountNumber: normalized.accountNumber,
      costCenter: normalized.costCenter,
      project: normalized.project,
      financialClass: normalized.financialClass,
      supplierCode,
      supplierCNPJ: normalized.supplierCNPJ,
      supplierName: normalized.supplierName,
      supplierSite: normalized.supplierSite,
      description: normalized.description,
      needByDate: normalized.needByDate,
      uom: normalized.uom,
      autoSubmit: true, // Sempre submeter automaticamente em lote
    };
  }

  /**
   * Detecta separador CSV (padrão; ; para arquivos com ;)
   */
  private detectCsvSeparator(buffer: Buffer): string {
    const preview = buffer.toString('utf8', 0, 1024);
    const semicolons = (preview.match(/;/g) || []).length;
    const commas = (preview.match(/,/g) || []).length;

    if (semicolons > commas) {
      return ';';
    }

    return ',';
  }

  /**
   * Normaliza cabeçalhos e valores da linha para campos padrão
   */
  private normalizeRow(row: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = {};

    Object.entries(row || {}).forEach(([header, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      const textValue = typeof value === 'string' ? value.trim() : value;
      const key = this.normalizeHeader(header);

      switch (key) {
        case 'businessunit':
        case 'business_unit':
        case 'business_unit_name':
        case 'un_requisicao':
        case 'un_requisicao_codigo':
        case 'un_requisicao': // Header do CSV: "Un Requisição" (com encoding)
          normalized.businessUnit = textValue;
          break;
        case 'deliverylocation':
        case 'local_entrega':
          normalized.deliveryLocation = textValue;
          break;
        case 'item':
        case 'itemnumber':
        case 'item_number':
          normalized.itemNumber = String(textValue);
          break;
        case 'preco':
        case 'price':
        case 'valor':
          normalized.price = textValue;
          break;
        case 'cod_fornecedor':
        case 'suppliercode':
        case 'supplier_code':
          normalized.supplierCode = textValue;
          break;
        case 'cnpj_fornecedor':
        case 'suppliercnpj':
        case 'supplier_cnpj':
          normalized.supplierCNPJ = String(textValue);
          break;
        case 'nome_fornecedor':
        case 'suppliername':
        case 'supplier_name':
          normalized.supplierName = textValue;
          break;
        case 'local_fornecedor':
        case 'suppliersite':
        case 'supplier_site':
          normalized.supplierSite = textValue;
          break;
        case 'conta_contabil':
        case 'accountnumber':
        case 'account_number':
          normalized.accountNumber = String(textValue);
          break;
        case 'centro_custo':
        case 'costcenter':
        case 'cost_center':
          normalized.costCenter = String(textValue);
          break;
        case 'projeto':
        case 'project':
          normalized.project = String(textValue);
          break;
        case 'classe_financeira':
        case 'financialclass':
        case 'financial_class':
          normalized.financialClass = String(textValue);
          break;
        case 'solicitante':
        case 'requester':
          normalized.requester = String(textValue);
          break;
        case 'requesteremail':
        case 'requester_email':
          normalized.requesterEmail = String(textValue);
          break;
        case 'quantity':
        case 'quantidade':
          normalized.quantity = textValue;
          break;
        case 'ticket':
        case 'protocolo':
          normalized.ticket = String(textValue);
          break;
        case 'descricao':
        case 'description':
          normalized.description = textValue;
          break;
        case 'needbydate':
        case 'need_by_date':
        case 'data_necessidade':
          normalized.needByDate = String(textValue);
          break;
        case 'uom':
        case 'unidade':
        case 'unidade_medida':
          normalized.uom = String(textValue);
          break;
        default:
          break;
      }
    });

    return normalized;
  }

  /**
   * Normaliza cabeçalho removendo acentos e caracteres especiais
   */
  private normalizeHeader(header: string): string {
    return header
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .toLowerCase()
      .replace(/^_+|_+$/g, '');
  }

  private normalizePrice(value: any): string {
    if (value === undefined || value === null || value === '') {
      return '0';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    const str = String(value).trim();
    if (!str) {
      return '0';
    }

    const noThousands = str.replace(/\./g, '');
    return noThousands.replace(',', '.');
  }

  private parseNumber(value: any): number | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const normalized = typeof value === 'string'
      ? value.replace(/\./g, '').replace(',', '.').trim()
      : value;

    const parsed = parseFloat(normalized);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private resolveRequesterEmail(requesterEmail?: string, requester?: string): string | undefined {
    if (requesterEmail && this.isEmail(requesterEmail)) {
      return requesterEmail;
    }

    if (requester && this.isEmail(requester)) {
      return requester;
    }

    return undefined;
  }

  private resolveTicket(
    ticket: string | undefined,
    requesterEmail: string | undefined,
    requester: string | undefined,
    itemNumber: string | undefined,
    batchId: string,
    index: number,
  ): string {
    if (ticket) {
      return ticket;
    }

    const base =
      requesterEmail ||
      requester ||
      itemNumber ||
      'CSV';

    const sanitized = base.replace(/[^a-zA-Z0-9]+/g, '').toUpperCase().slice(0, 12) || 'CSV';
    const suffix = batchId.slice(-6);

    return `${sanitized}-${suffix}-${(index + 1).toString().padStart(3, '0')}`;
  }

  private isEmail(value: string | undefined): boolean {
    if (!value) {
      return false;
    }

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}


