
import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsPositive, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RequisitionLineDTO {
  @IsOptional() @IsString() itemNumber?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() supplierNumber?: string;
  @IsNumber() @IsPositive() quantity!: number;
  @IsNumber() @Min(0) unitPrice!: number;
  @IsOptional() @IsString() costCenter?: string;
  @IsOptional() @IsString() projectNumber?: string;
  @IsOptional() @IsString() deliverToLocation?: string;
}

export class RequisitionDTO {
  @ApiProperty() @IsString() businessUnit!: string;
  @ApiProperty() @IsString() requesterUsernameOrEmail!: string;
  @IsOptional() @IsString() deliverToLocation?: string;
  @IsOptional() @IsString() description?: string;
  @ValidateNested({ each: true }) @Type(() => RequisitionLineDTO) @IsArray()
  lines!: RequisitionLineDTO[];
  @IsOptional() @IsBoolean() submit?: boolean;

  // Id externo opcional para idempotência via DFF
  @IsOptional() @IsString() externalReference?: string;
}

export class SubmitDTO {
  @ApiProperty() @IsString() requisitionId!: string;
}
