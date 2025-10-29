import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Repository } from 'typeorm';
import { BatchEntity, BatchStatus, RequisitionEntity, RequisitionStatus } from '../storage/entities';
import { RequisitionDTO } from '../fusion/dto/requisition.dto';
import { FusionService } from '../fusion/fusion.service';

export interface CreateBatchRequest {
  fileName: string;
  originalFileName?: string;
  requisitions: RequisitionDTO[];
  uploadedBy?: string;
  metadata?: any;
}

export interface BatchMetrics {
  totalItems: number;
  processedItems: number;
  successfulItems: number;
  failedItems: number;
  processingTime: number;
  averageProcessingTime: number;
}

@Injectable()
export class BatchesService {
  private readonly logger = new Logger(BatchesService.name);

  constructor(
    @InjectRepository(BatchEntity)
    private readonly batchRepository: Repository<BatchEntity>,
    @InjectRepository(RequisitionEntity)
    private readonly requisitionRepository: Repository<RequisitionEntity>,
    @InjectQueue('requisition-processing')
    private readonly requisitionQueue: Queue,
    private readonly fusionService: FusionService,
  ) {}

  async createBatch(request: CreateBatchRequest): Promise<BatchEntity> {
    this.logger.log(`Creating batch for file: ${request.fileName}`);

    const batch = this.batchRepository.create({
      fileName: request.fileName,
      originalFileName: request.originalFileName,
      totalItems: request.requisitions.length,
      uploadedBy: request.uploadedBy,
      metadata: request.metadata,
      status: BatchStatus.PENDING,
    });

    const savedBatch = await this.batchRepository.save(batch);

    // Create requisition entities
    const requisitions = request.requisitions.map((reqDto) => {
      const requisition = this.requisitionRepository.create({
        batchId: savedBatch.id,
        businessUnit: reqDto.businessUnit,
        requesterUsernameOrEmail: reqDto.requesterUsernameOrEmail,
        deliverToLocation: reqDto.deliverToLocation,
        externalReference: reqDto.externalReference,
        requestPayload: reqDto,
        lines: reqDto.lines,
        status: RequisitionStatus.PENDING,
      });
      return requisition;
    });

    await this.requisitionRepository.save(requisitions);

    // Enqueue processing jobs
    await this.enqueueBatchProcessing(savedBatch.id);

    this.logger.log(`Batch ${savedBatch.id} created with ${request.requisitions.length} requisitions`);
    return savedBatch;
  }

  async getBatch(id: string): Promise<BatchEntity> {
    const batch = await this.batchRepository.findOne({
      where: { id },
      relations: ['requisitions'],
    });

    if (!batch) {
      throw new NotFoundException(`Batch with ID ${id} not found`);
    }

    return batch;
  }

  async getBatchMetrics(id: string): Promise<BatchMetrics> {
    const batch = await this.getBatch(id);
    
    const startTime = batch.createdAt.getTime();
    const endTime = batch.status === BatchStatus.COMPLETED ? 
      batch.updatedAt.getTime() : Date.now();
    const processingTime = endTime - startTime;

    const averageProcessingTime = batch.processedItems > 0 ? 
      processingTime / batch.processedItems : 0;

    return {
      totalItems: batch.totalItems,
      processedItems: batch.processedItems,
      successfulItems: batch.successfulItems,
      failedItems: batch.failedItems,
      processingTime,
      averageProcessingTime,
    };
  }

  async listBatches(
    page: number = 1,
    limit: number = 10,
    status?: BatchStatus,
  ): Promise<{ batches: BatchEntity[]; total: number }> {
    const queryBuilder = this.batchRepository.createQueryBuilder('batch');

    if (status) {
      queryBuilder.where('batch.status = :status', { status });
    }

    const [batches, total] = await queryBuilder
      .orderBy('batch.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { batches, total };
  }

  async retryBatch(id: string): Promise<void> {
    const batch = await this.getBatch(id);
    
    if (batch.status === BatchStatus.PROCESSING) {
      throw new Error('Batch is currently processing');
    }

    // Reset failed requisitions
    await this.requisitionRepository.update(
      { batchId: id, status: RequisitionStatus.FAILED },
      { status: RequisitionStatus.PENDING, errorMessage: null }
    );

    // Reset batch status
    await this.batchRepository.update(id, {
      status: BatchStatus.PENDING,
      processedItems: 0,
      successfulItems: 0,
      failedItems: 0,
      errorMessage: null,
    });

    // Re-enqueue processing
    await this.enqueueBatchProcessing(id);

    this.logger.log(`Batch ${id} queued for retry`);
  }

  private async enqueueBatchProcessing(batchId: string): Promise<void> {
    const batch = await this.getBatch(batchId);
    
    // Update batch status
    await this.batchRepository.update(batchId, { 
      status: BatchStatus.PROCESSING 
    });

    // Enqueue individual requisition processing jobs
    const requisitions = batch.requisitions || await this.requisitionRepository.find({
      where: { batchId },
    });

    for (const requisition of requisitions) {
      await this.requisitionQueue.add(
        'process-requisition',
        { batchId, requisitionId: requisition.id },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    }

    this.logger.log(`Enqueued ${requisitions.length} requisitions for batch ${batchId}`);
  }

  async updateBatchStatus(
    batchId: string,
    status: BatchStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.batchRepository.update(batchId, { status, errorMessage });
  }

  async updateBatchCounts(batchId: string): Promise<void> {
    const counts = await this.requisitionRepository
      .createQueryBuilder('requisition')
      .select([
        'COUNT(*) as total',
        'COUNT(CASE WHEN status IN (:...processedStatuses) THEN 1 END) as processed',
        'COUNT(CASE WHEN status IN (:...successStatuses) THEN 1 END) as successful',
        'COUNT(CASE WHEN status = :failedStatus THEN 1 END) as failed',
      ])
      .where('requisition.batchId = :batchId', { batchId })
      .setParameters({
        processedStatuses: [
          RequisitionStatus.CREATED,
          RequisitionStatus.SUBMITTED,
          RequisitionStatus.APPROVED,
          RequisitionStatus.REJECTED,
          RequisitionStatus.FAILED,
        ],
        successStatuses: [
          RequisitionStatus.CREATED,
          RequisitionStatus.SUBMITTED,
          RequisitionStatus.APPROVED,
        ],
        failedStatus: RequisitionStatus.FAILED,
      })
      .getRawOne();

    const finalStatus = counts.failed === counts.total ? BatchStatus.FAILED :
      counts.successful === counts.total ? BatchStatus.COMPLETED :
      counts.processed > 0 ? BatchStatus.PARTIALLY_FAILED :
      BatchStatus.PROCESSING;

    await this.batchRepository.update(batchId, {
      processedItems: parseInt(counts.processed),
      successfulItems: parseInt(counts.successful),
      failedItems: parseInt(counts.failed),
      status: finalStatus,
    });
  }
}

