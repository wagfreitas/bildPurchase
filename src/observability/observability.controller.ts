import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ObservabilityService, SystemMetrics, HealthCheckResponse } from './observability.service';

@ApiTags('observability')
@Controller('observability')
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get system metrics and statistics' })
  @ApiResponse({ status: 200, description: 'System metrics' })
  async getMetrics(): Promise<SystemMetrics> {
    return await this.observabilityService.getSystemMetrics();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get system health status' })
  @ApiResponse({ status: 200, description: 'Health check results' })
  async getHealth(): Promise<HealthCheckResponse> {
    return await this.observabilityService.getHealthCheck();
  }
}

