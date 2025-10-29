import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RequisitionEntity, RequisitionStatus } from '../storage/entities';
import { BatchesService } from './batches.service';
import { FusionService } from '../fusion/fusion.service';

export interface RequisitionProcessingJob {
  batchId: string;
  requisitionId: string;
}

@Processor('requisition-processing')
export class BatchProcessor {
  private readonly logger = new Logger(BatchProcessor.name);

  constructor(
    @InjectRepository(RequisitionEntity)
    private readonly requisitionRepository: Repository<RequisitionEntity>,
    private readonly batchesService: BatchesService,
    private readonly fusionService: FusionService,
  ) {}

  @Process('process-requisition')
  async processRequisition(job: Job<RequisitionProcessingJob>) {
    const { batchId, requisitionId } = job.data;
    
    this.logger.log(`Processing requisition ${requisitionId} from batch ${batchId}`);

    try {
      const requisition = await this.requisitionRepository.findOne({
        where: { id: requisitionId },
      });

      if (!requisition) {
        throw new Error(`Requisition ${requisitionId} not found`);
      }

      if (requisition.status !== RequisitionStatus.PENDING) {
        this.logger.warn(`Requisition ${requisitionId} is not in PENDING status: ${requisition.status}`);
        return;
      }

      // Check for idempotency if external reference is provided
      if (requisition.externalReference) {
        try {
          const existing = await this.fusionService.findRequisitionByExternalRef(
            requisition.externalReference,
          );
          if (existing?.items?.length > 0) {
            this.logger.warn(`Requisition with external reference ${requisition.externalReference} already exists`);
            await this.requisitionRepository.update(requisitionId, {
              status: RequisitionStatus.FAILED,
              errorMessage: 'Duplicate external reference',
            });
            return;
          }
        } catch (error) {
          this.logger.warn(`Could not check for duplicates: ${error.message}`);
        }
      }

      // Create requisition in Fusion
      const fusionResponse = await this.createRequisitionInFusion(requisition);
      
      await this.requisitionRepository.update(requisitionId, {
        status: RequisitionStatus.CREATED,
        fusionRequisitionId: fusionResponse.RequisitionHeaderId || fusionResponse.Id || fusionResponse.id,
        requisitionNumber: fusionResponse.RequisitionNumber,
        responsePayload: fusionResponse,
      });

      // Submit requisition if requested
      const requestPayload = requisition.requestPayload;
      if (requestPayload?.submit) {
        await this.submitRequisitionInFusion(requisition, fusionResponse);
      }

      this.logger.log(`Successfully processed requisition ${requisitionId}`);

    } catch (error) {
      this.logger.error(`Failed to process requisition ${requisitionId}: ${error.message}`);
      
      await this.requisitionRepository.update(requisitionId, {
        status: RequisitionStatus.FAILED,
        errorMessage: error.message,
      });

      throw error; // Re-throw to trigger retry mechanism
    }
  }

  private async createRequisitionInFusion(requisition: RequisitionEntity): Promise<any> {
    const requestPayload = requisition.requestPayload;
    
    const header: any = {
      BusinessUnit: requestPayload.businessUnit,
      Requester: requestPayload.requesterUsernameOrEmail,
      DeliverToLocation: requestPayload.deliverToLocation,
    };

    // Add external reference if provided
    if (requestPayload.externalReference) {
      const dffField = process.env.EXTERNAL_REF_FIELD || 'ExternalReference';
      header[dffField] = requestPayload.externalReference;
    }

    const lines = requestPayload.lines.map((line: any) => ({
      ItemNumber: line.itemNumber,
      ItemDescription: line.description,
      SupplierNumber: line.supplierNumber,
      Quantity: line.quantity,
      UnitPrice: line.unitPrice,
      DeliverToLocation: line.deliverToLocation,
      Distributions: [{
        CostCenter: line.costCenter,
        ProjectNumber: line.projectNumber,
      }],
    }));

    const payload = { ...header, RequisitionLines: lines };
    
    return await this.fusionService.createRequisition(payload);
  }

  private async submitRequisitionInFusion(requisition: RequisitionEntity, fusionResponse: any): Promise<void> {
    const requisitionId = fusionResponse.RequisitionHeaderId || fusionResponse.Id || fusionResponse.id;
    
    if (!requisitionId) {
      throw new Error('No requisition ID returned from Fusion');
    }

    try {
      await this.fusionService.submitRequisition(String(requisitionId));
      
      await this.requisitionRepository.update(requisition.id, {
        status: RequisitionStatus.SUBMITTED,
        submitted: true,
        submittedAt: new Date(),
      });

      this.logger.log(`Successfully submitted requisition ${requisition.id} to Fusion`);
    } catch (error) {
      this.logger.error(`Failed to submit requisition ${requisition.id}: ${error.message}`);
      
      await this.requisitionRepository.update(requisition.id, {
        status: RequisitionStatus.FAILED,
        errorMessage: `Submit failed: ${error.message}`,
      });

      throw error;
    }
  }
}

