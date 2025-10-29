
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FusionService } from './fusion.service';
import { FusionController } from './fusion.controller';
import { ItemLookupService } from './item-lookup.service';
import { OrganizationLookupService } from './organization-lookup.service';

@Module({
  imports: [ConfigModule, AuthModule, HttpModule.register({ timeout: 20000 })],
  providers: [FusionService, ItemLookupService, OrganizationLookupService],
  controllers: [FusionController],
  exports: [FusionService, ItemLookupService, OrganizationLookupService],
})
export class FusionModule {}
