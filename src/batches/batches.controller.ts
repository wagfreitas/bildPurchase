import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiParam, ApiQuery } from '@nestjs/swagger';
import { BatchesService, CreateBatchRequest } from './batches.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { BatchEntity, BatchStatus } from '../storage/entities';

@ApiTags('batches')
@Controller('batches')
export class BatchesController {
  constructor(
    private readonly batchesService: BatchesService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new batch from file upload' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Batch created successfully', type: BatchEntity })
  @ApiResponse({ status: 400, description: 'Invalid file format or data' })
  @UseInterceptors(FileInterceptor('file'))
  async createBatchFromFile(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BatchEntity> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760'); // 10MB default
    if (file.size > maxSize) {
      throw new BadRequestException(`File size exceeds limit of ${maxSize} bytes`);
    }

    try {
      // Parse the uploaded file
      const requisitions = await this.ingestionService.parseFile(file);
      
      if (requisitions.length === 0) {
        throw new BadRequestException('No valid requisitions found in file');
      }

      const createBatchRequest: CreateBatchRequest = {
        fileName: file.filename || file.originalname,
        originalFileName: file.originalname,
        requisitions,
        metadata: {
          fileSize: file.size,
          mimeType: file.mimetype,
        },
      };

      return await this.batchesService.createBatch(createBatchRequest);
    } catch (error) {
      throw new BadRequestException(`Failed to process file: ${error.message}`);
    }
  }

  @Post('json')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new batch from JSON payload' })
  @ApiResponse({ status: 201, description: 'Batch created successfully', type: BatchEntity })
  @ApiResponse({ status: 400, description: 'Invalid JSON data' })
  async createBatchFromJson(
    @Body() request: CreateBatchRequest,
  ): Promise<BatchEntity> {
    if (!request.requisitions || request.requisitions.length === 0) {
      throw new BadRequestException('No requisitions provided');
    }

    return await this.batchesService.createBatch(request);
  }

  @Get()
  @ApiOperation({ summary: 'List all batches with pagination and filtering' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10)' })
  @ApiQuery({ name: 'status', required: false, enum: BatchStatus, description: 'Filter by batch status' })
  @ApiResponse({ status: 200, description: 'List of batches' })
  async listBatches(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: BatchStatus,
  ) {
    return await this.batchesService.listBatches(
      page ? parseInt(page.toString()) : 1,
      limit ? parseInt(limit.toString()) : 10,
      status,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get batch details by ID' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({ status: 200, description: 'Batch details', type: BatchEntity })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async getBatch(@Param('id') id: string): Promise<BatchEntity> {
    try {
      return await this.batchesService.getBatch(id);
    } catch (error) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }
  }

  @Get(':id/metrics')
  @ApiOperation({ summary: 'Get batch processing metrics' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({ status: 200, description: 'Batch metrics' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async getBatchMetrics(@Param('id') id: string) {
    try {
      return await this.batchesService.getBatchMetrics(id);
    } catch (error) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry failed items in a batch' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({ status: 200, description: 'Batch queued for retry' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  @ApiResponse({ status: 400, description: 'Batch cannot be retried' })
  async retryBatch(@Param('id') id: string): Promise<{ message: string }> {
    try {
      await this.batchesService.retryBatch(id);
      return { message: 'Batch queued for retry' };
    } catch (error) {
      if (error.message.includes('not found')) {
        throw new NotFoundException(`Batch with ID ${id} not found`);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export batch results to CSV' })
  @ApiParam({ name: 'id', description: 'Batch ID' })
  @ApiResponse({ status: 200, description: 'CSV file with batch results' })
  @ApiResponse({ status: 404, description: 'Batch not found' })
  async exportBatchResults(@Param('id') id: string) {
    try {
      const batch = await this.batchesService.getBatch(id);
      return await this.ingestionService.exportBatchResults(batch);
    } catch (error) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }
  }
}
