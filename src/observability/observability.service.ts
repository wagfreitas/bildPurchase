import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BatchEntity, RequisitionEntity, BatchStatus, RequisitionStatus } from '../storage/entities';

export interface SystemMetrics {
  batches: {
    total: number;
    byStatus: Record<BatchStatus, number>;
  };
  requisitions: {
    total: number;
    byStatus: Record<RequisitionStatus, number>;
  };
  processing: {
    averageProcessingTime: number;
    successRate: number;
    failureRate: number;
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly startTime = Date.now();

  constructor(
    @InjectRepository(BatchEntity)
    private readonly batchRepository: Repository<BatchEntity>,
    @InjectRepository(RequisitionEntity)
    private readonly requisitionRepository: Repository<RequisitionEntity>,
  ) {}

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      // Batch metrics
      const batchCounts = await this.batchRepository
        .createQueryBuilder('batch')
        .select('batch.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('batch.status')
        .getRawMany();

      const batchMetrics = batchCounts.reduce((acc, item: any) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {} as Record<BatchStatus, number>);

      // Requisition metrics
      const requisitionCounts = await this.requisitionRepository
        .createQueryBuilder('requisition')
        .select('requisition.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('requisition.status')
        .getRawMany();

      const requisitionMetrics = requisitionCounts.reduce((acc, item: any) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {} as Record<RequisitionStatus, number>);

      // Processing metrics
      const processingStats = await this.calculateProcessingStats();

      // System metrics
      const systemMetrics = {
        uptime: Date.now() - this.startTime,
        memoryUsage: process.memoryUsage(),
      };

      const batchTotal = Object.values(batchMetrics).reduce((sum, count) => (sum as number) + (count as number), 0) as number;
      const requisitionTotal = Object.values(requisitionMetrics).reduce((sum, count) => (sum as number) + (count as number), 0) as number;

      return {
        batches: {
          total: batchTotal,
          byStatus: batchMetrics,
        },
        requisitions: {
          total: requisitionTotal,
          byStatus: requisitionMetrics,
        },
        processing: processingStats,
        system: systemMetrics,
      };
    } catch (error) {
      this.logger.error(`Failed to get system metrics: ${error.message}`);
      throw error;
    }
  }

  private async calculateProcessingStats(): Promise<{
    averageProcessingTime: number;
    successRate: number;
    failureRate: number;
  }> {
    try {
      const completedBatches = await this.batchRepository
        .createQueryBuilder('batch')
        .where('batch.status IN (:...statuses)', {
          statuses: [BatchStatus.COMPLETED, BatchStatus.FAILED, BatchStatus.PARTIALLY_FAILED],
        })
        .getMany();

      if (completedBatches.length === 0) {
        return {
          averageProcessingTime: 0,
          successRate: 0,
          failureRate: 0,
        };
      }

      const totalProcessingTime = completedBatches.reduce((sum, batch) => {
        return sum + (batch.updatedAt.getTime() - batch.createdAt.getTime());
      }, 0);

      const averageProcessingTime = totalProcessingTime / completedBatches.length;

      const totalItems = completedBatches.reduce((sum, batch) => sum + batch.totalItems, 0);
      const successfulItems = completedBatches.reduce((sum, batch) => sum + batch.successfulItems, 0);
      const failedItems = completedBatches.reduce((sum, batch) => sum + batch.failedItems, 0);

      const successRate = totalItems > 0 ? (successfulItems / totalItems) * 100 : 0;
      const failureRate = totalItems > 0 ? (failedItems / totalItems) * 100 : 0;

      return {
        averageProcessingTime,
        successRate,
        failureRate,
      };
    } catch (error) {
      this.logger.error(`Failed to calculate processing stats: ${error.message}`);
      return {
        averageProcessingTime: 0,
        successRate: 0,
        failureRate: 0,
      };
    }
  }

  async logBatchEvent(
    batchId: string,
    event: string,
    data?: any,
  ): Promise<void> {
    this.logger.log({
      batchId,
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async logRequisitionEvent(
    requisitionId: string,
    batchId: string,
    event: string,
    data?: any,
  ): Promise<void> {
    this.logger.log({
      requisitionId,
      batchId,
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async logFusionAPICall(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
    error?: string,
  ): Promise<void> {
    const level = statusCode >= 400 ? 'error' : 'info';
    this.logger[level]({
      type: 'fusion_api_call',
      endpoint,
      method,
      duration,
      statusCode,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  async logSystemEvent(
    event: string,
    level: 'info' | 'warn' | 'error',
    data?: any,
  ): Promise<void> {
    this.logger[level]({
      type: 'system_event',
      event,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async getHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: {
      database: 'healthy' | 'unhealthy';
      redis: 'healthy' | 'unhealthy';
      fusion: 'healthy' | 'unhealthy';
    };
    timestamp: string;
  }> {
    const checks = {
      database: await this.checkDatabaseHealth(),
      redis: await this.checkRedisHealth(),
      fusion: await this.checkFusionHealth(),
    };

    const overallStatus = Object.values(checks).every(status => status === 'healthy')
      ? 'healthy'
      : 'unhealthy';

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabaseHealth(): Promise<'healthy' | 'unhealthy'> {
    try {
      await this.batchRepository.query('SELECT 1');
      return 'healthy';
    } catch (error) {
      this.logger.error(`Database health check failed: ${error.message}`);
      return 'unhealthy';
    }
  }

  private async checkRedisHealth(): Promise<'healthy' | 'unhealthy'> {
    // Redis health check would be implemented here
    // For now, returning healthy as a placeholder
    return 'healthy';
  }

  private async checkFusionHealth(): Promise<'healthy' | 'unhealthy'> {
    // Fusion API health check would be implemented here
    // This could involve checking if we can get an access token
    return 'healthy';
  }
}

