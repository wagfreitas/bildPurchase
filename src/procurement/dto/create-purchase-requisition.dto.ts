import { IsString, IsNumber, IsOptional, IsNotEmpty, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para criar uma Purchase Requisition no Oracle Fusion
 * 
 * Baseado nos dados recebidos da Zeev
 */
export class CreatePurchaseRequisitionDto {
  @IsString()
  @IsNotEmpty()
  businessUnit: string; // Ex: "V30326 TRINITA"

  @IsString()
  @IsOptional()
  deliveryLocation?: string; // Ex: "LOC_V30326" (opcional - derivado da BU)

  @IsString()
  @IsNotEmpty()
  itemNumber: string; // Ex: "SVC20119" (obrigatório)

  @IsNumber()
  @IsOptional()
  quantity?: number; // Padrão: 1

  @IsString()
  @IsNotEmpty()
  price: string; // Ex: "12400,4" (obrigatório)

  @IsNumber()
  @IsOptional()
  supplierCode?: number; // Ex: 65007 (opcional)

  @IsString()
  @IsOptional()
  supplierCNPJ?: string; // Ex: "31303450000187" (opcional)

  @IsString()
  @IsOptional()
  supplierName?: string; // Ex: "IGOR AL HAJ NAVES PEREIRA" (opcional)

  @IsString()
  @IsOptional()
  supplierSite?: string; // Ex: "31303450000187" (opcional)

  @IsString()
  @IsOptional()
  accountNumber?: string; // Ex: "32102040021" (opcional)

  @IsString()
  @IsOptional()
  costCenter?: string; // Ex: "CC0091" (opcional)

  @IsString()
  @IsOptional()
  project?: string; // Ex: "PV0508" (opcional)

  @IsString()
  @IsOptional()
  financialClass?: string; // Ex: "CF001" (opcional - Classe Financeira para ChargeAccount e DFF)

  @IsString()
  @IsOptional()
  requester?: string; // Ex: "LALESCA BERNARDES COELHO SILVA" (opcional - nome para nota)

  @IsString()
  @IsOptional()
  requesterEmail?: string; // Ex: "camila.americo@bild.com.br" (opcional - padrão: automacao.csc@bild.com.br)

  @IsString()
  @IsOptional()
  needByDate?: string; // Data necessária (formato ISO)

  @IsString()
  @IsNotEmpty()
  ticket: string; // Ex: "796047" (controle interno Zeev)

  @IsString()
  @IsOptional()
  description?: string; // Descrição da requisição

  @IsString()
  @IsOptional()
  uom?: string; // Unidade de medida (padrão: "Each")

  @IsString()
  @IsOptional()
  currencyCode?: string; // Moeda (padrão: "BRL")

  @IsBoolean()
  @IsOptional()
  autoSubmit?: boolean; // Se true, submete automaticamente para aprovação (padrão: true)
}

