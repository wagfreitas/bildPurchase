import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parser';
import * as ExcelJS from 'exceljs';
import { RequisitionDTO, RequisitionLineDTO } from '../fusion/dto/requisition.dto';

export interface ParsedFileResult {
  requisitions: RequisitionDTO[];
  errors: string[];
  metadata: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
  };
}

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  async parseFile(file: Express.Multer.File): Promise<RequisitionDTO[]> {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    this.logger.log(`Parsing file: ${file.originalname} (${fileExtension})`);

    switch (fileExtension) {
      case '.csv':
        return await this.parseCSV(file);
      case '.xlsx':
      case '.xls':
        return await this.parseExcel(file);
      default:
        throw new BadRequestException(`Unsupported file format: ${fileExtension}`);
    }
  }

  private async parseCSV(file: Express.Multer.File): Promise<RequisitionDTO[]> {
    return new Promise((resolve, reject) => {
      const results: RequisitionDTO[] = [];
      const errors: string[] = [];

      fs.createReadStream(file.path)
        .pipe(csv())
        .on('data', (row) => {
          try {
            const requisition = this.mapCSVRowToRequisition(row);
            if (requisition) {
              results.push(requisition);
            }
          } catch (error) {
            errors.push(`Row error: ${error.message}`);
          }
        })
        .on('end', () => {
          this.logger.log(`CSV parsing completed. Valid: ${results.length}, Errors: ${errors.length}`);
          
          if (results.length === 0) {
            reject(new BadRequestException('No valid requisitions found in CSV file'));
          } else {
            resolve(results);
          }
        })
        .on('error', (error) => {
          reject(new BadRequestException(`CSV parsing error: ${error.message}`));
        });
    });
  }

  private async parseExcel(file: Express.Multer.File): Promise<RequisitionDTO[]> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      
      const worksheet = workbook.getWorksheet(1); // First sheet
      if (!worksheet) {
        throw new BadRequestException('No worksheet found in Excel file');
      }

      const headers = this.extractExcelHeaders(worksheet);
      const results: RequisitionDTO[] = [];
      const errors: string[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row

        try {
          const requisition = this.mapExcelRowToRequisition(row, headers);
          if (requisition) {
            results.push(requisition);
          }
        } catch (error) {
          errors.push(`Row ${rowNumber} error: ${error.message}`);
        }
      });

      this.logger.log(`Excel parsing completed. Valid: ${results.length}, Errors: ${errors.length}`);

      if (results.length === 0) {
        throw new BadRequestException('No valid requisitions found in Excel file');
      }

      return results;
    } catch (error) {
      throw new BadRequestException(`Excel parsing error: ${error.message}`);
    }
  }

  private extractExcelHeaders(worksheet: ExcelJS.Worksheet): string[] {
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = cell.value?.toString().toLowerCase().trim() || '';
    });

    return headers;
  }

  private mapCSVRowToRequisition(row: any): RequisitionDTO | null {
    // Map common CSV column names to our DTO
    const mapping = {
      businessUnit: ['business_unit', 'businessunit', 'bu', 'empresa', 'unidade'],
      requesterUsernameOrEmail: ['requester', 'solicitante', 'user', 'username', 'email'],
      deliverToLocation: ['deliver_to', 'deliverto', 'local_entrega', 'location'],
      externalReference: ['external_ref', 'externalreference', 'referencia', 'id_externo'],
      itemNumber: ['item_number', 'itemnumber', 'item', 'codigo_item'],
      description: ['desc', 'descricao', 'item_description'],
      supplierNumber: ['supplier_number', 'suppliernumber', 'fornecedor', 'supplier'],
      quantity: ['qty', 'quantidade', 'quantity'],
      unitPrice: ['unit_price', 'unitprice', 'preco', 'price', 'valor'],
      costCenter: ['cost_center', 'costcenter', 'centro_custo', 'cc'],
      projectNumber: ['project_number', 'projectnumber', 'projeto', 'project'],
    };

    const mappedRow = this.mapRowData(row, mapping);
    
    return this.validateAndCreateRequisition(mappedRow);
  }

  private mapExcelRowToRequisition(row: ExcelJS.Row, headers: string[]): RequisitionDTO | null {
    const rowData: any = {};
    
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        rowData[header] = cell.value;
      }
    });

    return this.mapCSVRowToRequisition(rowData);
  }

  private mapRowData(row: any, mapping: Record<string, string[]>): any {
    const mapped: any = {};

    Object.entries(mapping).forEach(([targetField, sourceFields]) => {
      for (const sourceField of sourceFields) {
        if (row[sourceField] !== undefined && row[sourceField] !== null && row[sourceField] !== '') {
          mapped[targetField] = row[sourceField];
          break;
        }
      }
    });

    return mapped;
  }

  private validateAndCreateRequisition(data: any): RequisitionDTO | null {
    // Required fields validation
    if (!data.businessUnit || !data.requesterUsernameOrEmail) {
      throw new Error('Missing required fields: businessUnit and requesterUsernameOrEmail');
    }

    // Create at least one line if no lines provided
    if (!data.lines || data.lines.length === 0) {
      if (!data.itemNumber && !data.description) {
        throw new Error('At least one line with itemNumber or description is required');
      }

      const line: RequisitionLineDTO = {
        itemNumber: data.itemNumber,
        description: data.description,
        supplierNumber: data.supplierNumber,
        quantity: parseFloat(data.quantity) || 1,
        unitPrice: parseFloat(data.unitPrice) || 0,
        costCenter: data.costCenter,
        projectNumber: data.projectNumber,
        deliverToLocation: data.deliverToLocation,
      };

      data.lines = [line];
    }

    // Validate lines
    for (const line of data.lines) {
      if (line.quantity <= 0) {
        throw new Error('Quantity must be greater than 0');
      }
      if (line.unitPrice < 0) {
        throw new Error('Unit price cannot be negative');
      }
      if (!line.itemNumber && !line.description) {
        throw new Error('Line must have either itemNumber or description');
      }
    }

    const requisition: RequisitionDTO = {
      businessUnit: data.businessUnit,
      requesterUsernameOrEmail: data.requesterUsernameOrEmail,
      deliverToLocation: data.deliverToLocation,
      externalReference: data.externalReference,
      lines: data.lines,
      submit: data.submit === true || data.submit === 'true' || data.submit === '1',
    };

    return requisition;
  }

  // exportBatchResults removido (sem BD)

  async validateRequisitionData(requisitions: RequisitionDTO[]): Promise<{
    valid: RequisitionDTO[];
    invalid: { requisition: RequisitionDTO; errors: string[] }[];
  }> {
    const valid: RequisitionDTO[] = [];
    const invalid: { requisition: RequisitionDTO; errors: string[] }[] = [];

    for (const requisition of requisitions) {
      const errors: string[] = [];

      // Validate required fields
      if (!requisition.businessUnit) {
        errors.push('Business unit is required');
      }
      if (!requisition.requesterUsernameOrEmail) {
        errors.push('Requester is required');
      }
      if (!requisition.lines || requisition.lines.length === 0) {
        errors.push('At least one line is required');
      }

      // Validate lines
      if (requisition.lines) {
        requisition.lines.forEach((line, index) => {
          if (!line.itemNumber && !line.description) {
            errors.push(`Line ${index + 1}: Item number or description is required`);
          }
          if (line.quantity <= 0) {
            errors.push(`Line ${index + 1}: Quantity must be greater than 0`);
          }
          if (line.unitPrice < 0) {
            errors.push(`Line ${index + 1}: Unit price cannot be negative`);
          }
        });
      }

      if (errors.length === 0) {
        valid.push(requisition);
      } else {
        invalid.push({ requisition, errors });
      }
    }

    return { valid, invalid };
  }
}

