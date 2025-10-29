import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { IngestionService, ParsedFileResult } from './ingestion.service';
import { RequisitionDTO } from '../fusion/dto/requisition.dto';

@ApiTags('ingestion')
@ApiExcludeController() // Ocultar do Swagger - usar /procurement/purchase-requisitions
@Controller('ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate requisition data without creating batch' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Validation results' })
  @ApiResponse({ status: 400, description: 'Invalid file format' })
  @UseInterceptors(FileInterceptor('file'))
  async validateFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ParsedFileResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const requisitions = await this.ingestionService.parseFile(file);
      const validation = await this.ingestionService.validateRequisitionData(requisitions);

      return {
        requisitions: validation.valid,
        errors: validation.invalid.flatMap(item => 
          item.errors.map(error => `${JSON.stringify(item.requisition)}: ${error}`)
        ),
        metadata: {
          totalRows: requisitions.length,
          validRows: validation.valid.length,
          invalidRows: validation.invalid.length,
        },
      };
    } catch (error) {
      throw new BadRequestException(`File validation failed: ${error.message}`);
    }
  }

  @Post('template')
  @ApiOperation({ summary: 'Download CSV template for requisitions' })
  @ApiResponse({ status: 200, description: 'CSV template file' })
  async downloadTemplate(@Res() res: Response): Promise<void> {
    const template = `business_unit,requester,deliver_to_location,external_reference,item_number,description,supplier_number,quantity,unit_price,cost_center,project_number,submit
BU001,user@company.com,LOC001,REF001,ITEM001,Office Supplies,SUP001,10,25.50,CC001,PROJ001,true
BU001,user@company.com,LOC001,REF002,ITEM002,Software License,SUP002,1,1000.00,CC002,PROJ002,false`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="requisition_template.csv"');
    res.send(template);
  }
}

