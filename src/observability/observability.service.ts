import { Injectable, Logger } from '@nestjs/common';

export interface SystemMetrics {
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
  };
  fusion: {
    reachable: boolean;
  };
}

@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly startTime = Date.now();

  constructor() {}

  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      // System metrics
      const systemMetrics = {
        uptime: Date.now() - this.startTime,
        memoryUsage: process.memoryUsage(),
      };

      return {
        system: systemMetrics,
        fusion: { reachable: true },
      };
    } catch (error) {
      this.logger.error(`Failed to get system metrics: ${error.message}`);
      throw error;
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
      fusion: 'healthy' | 'unhealthy';
    };
    timestamp: string;
  }> {
    const checks = {
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

  private async checkFusionHealth(): Promise<'healthy' | 'unhealthy'> {
    // Fusion API health check would be implemented here
    // This could involve checking if we can get an access token
    return 'healthy';
  }
}

