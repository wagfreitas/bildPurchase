
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { FusionModule } from './fusion/fusion.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { ProcurementModule } from './procurement/procurement.module';

@Module({
  imports: [
    ConfigModule.forRoot({ 
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AuthModule,
    FusionModule,
    IngestionModule,
    ProcurementModule,
  ],
})
export class AppModule {}
