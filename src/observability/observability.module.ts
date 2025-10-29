import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';
import { BatchEntity, RequisitionEntity } from '../storage/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([BatchEntity, RequisitionEntity]),
  ],
  controllers: [ObservabilityController],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
