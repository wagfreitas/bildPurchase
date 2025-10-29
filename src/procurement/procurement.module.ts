import { Module } from '@nestjs/common';
import { ProcurementController } from './procurement.controller';
import { PurchaseRequisitionService } from './services/purchase-requisition.service';
import { FusionModule } from '../fusion/fusion.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Módulo de Procurement para gerenciar Purchase Requisitions
 * 
 * Este módulo fornece funcionalidades para:
 * - Criar requisições de compra no Oracle Fusion
 * - Consultar requisições existentes
 * - Listar requisições com filtros
 */
@Module({
  imports: [FusionModule, AuthModule],
  controllers: [ProcurementController],
  providers: [PurchaseRequisitionService],
  exports: [PurchaseRequisitionService],
})
export class ProcurementModule {}
