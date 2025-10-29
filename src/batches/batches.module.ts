import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';
import { BatchProcessor } from './batch.processor';
import { BatchEntity, RequisitionEntity } from '../storage/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([BatchEntity, RequisitionEntity]),
    BullModule.registerQueue({
      name: 'requisition-processing',
    }),
  ],
  controllers: [BatchesController],
  providers: [BatchesService, BatchProcessor],
  exports: [BatchesService],
})
export class BatchesModule {}

