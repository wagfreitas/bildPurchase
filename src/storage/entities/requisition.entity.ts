import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BatchEntity } from './batch.entity';

export enum RequisitionStatus {
  PENDING = 'PENDING',
  CREATED = 'CREATED',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED',
}

@Entity('requisitions')
export class RequisitionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  businessUnit: string;

  @Column({ type: 'varchar', length: 255 })
  requesterUsernameOrEmail: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  deliverToLocation: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalReference: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fusionRequisitionId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  requisitionNumber: string;

  @Column({ type: 'enum', enum: RequisitionStatus, default: RequisitionStatus.PENDING })
  status: RequisitionStatus;

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'jsonb' })
  requestPayload: any;

  @Column({ type: 'jsonb', nullable: true })
  responsePayload: any;

  @Column({ type: 'jsonb', nullable: true })
  lines: any[];

  @Column({ type: 'boolean', default: false })
  submitted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date;

  @ManyToOne(() => BatchEntity, (batch) => batch.requisitions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: BatchEntity;

  @Column({ type: 'uuid' })
  batchId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
