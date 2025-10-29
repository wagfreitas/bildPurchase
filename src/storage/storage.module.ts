import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BatchEntity } from './entities/batch.entity';
import { RequisitionEntity } from './entities/requisition.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'fusion_api'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE', 'fusion_requisitions'),
        entities: [BatchEntity, RequisitionEntity],
        synchronize: configService.get('NODE_ENV') === 'development',
        logging: configService.get('NODE_ENV') === 'development',
        ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([BatchEntity, RequisitionEntity]),
  ],
  exports: [TypeOrmModule],
})
export class StorageModule {}
