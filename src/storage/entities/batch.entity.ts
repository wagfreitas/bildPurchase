import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { RequisitionEntity } from './requisition.entity';

export enum BatchStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PARTIALLY_FAILED = 'PARTIALLY_FAILED',
}

@Entity('batches')
export class BatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  originalFileName: string;

  @Column({ type: 'enum', enum: BatchStatus, default: BatchStatus.PENDING })
  status: BatchStatus;

  @Column({ type: 'int', default: 0 })
  totalItems: number;

  @Column({ type: 'int', default: 0 })
  processedItems: number;

  @Column({ type: 'int', default: 0 })
  successfulItems: number;

  @Column({ type: 'int', default: 0 })
  failedItems: number;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ type: 'varchar', length: 255, nullable: true })
  uploadedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => RequisitionEntity, (requisition) => requisition.batch)
  requisitions: RequisitionEntity[];
}
