import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../../auth/auth.service';
import { ItemLookupService } from '../../fusion/item-lookup.service';
import { OrganizationLookupService } from '../../fusion/organization-lookup.service';
import { FusionService } from '../../fusion/fusion.service';
import axios, { AxiosInstance } from 'axios';
import { CreatePurchaseRequisitionDto } from '../dto/create-purchase-requisition.dto';

/**
 * Serviço para criar Purchase Requisitions no Oracle Fusion
 * 
 * Endpoint Oracle: /fscmRestApi/resources/11.13.18.05/purchaseRequisitions
 * Documentação: https://docs.oracle.com/en/cloud/saas/procurement/25a/fapra/
 */
@Injectable()
export class PurchaseRequisitionService {
  private readonly logger = new Logger(PurchaseRequisitionService.name);
  private axiosInstance: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiVersion: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly itemLookupService: ItemLookupService,
    private readonly organizationLookupService: OrganizationLookupService,
    private readonly fusionService: FusionService,
  ) {
    this.baseUrl = this.configService.get<string>('FUSION_BASE_URL') || '';
    if (!this.baseUrl) {
      this.logger.warn('⚠️ FUSION_BASE_URL não configurado');
    }
    this.apiVersion = this.configService.get<string>('FUSION_REST_VERSION') || '11.13.18.05';

    this.axiosInstance = axios.create({
      timeout: 60000, // 60 segundos para criação
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Cria uma Purchase Requisition no Oracle Fusion
   * 
   * @param dto Dados da requisição de compras
   * @returns Purchase Requisition criada
   */
  async createPurchaseRequisition(dto: CreatePurchaseRequisitionDto): Promise<any> {
    const operationId = `PR_CREATE_${Date.now()}`;
    
    this.logger.log(`Iniciando criação de Purchase Requisition - Ticket: ${dto.ticket} [${operationId}]`);

    try {
      // 1. Buscar dados da Inventory Organization pelo nome da Business Unit
      // Input RPA/Zeev: "V30326 TRINITA" (nome completo da BU)
      // Processo: "V30326 TRINITA" → "OI_V30326" → buscar dados completos
      const businessUnitName = dto.businessUnit;
      
      this.logger.log(`Buscando dados da organização para BU: ${businessUnitName} [${operationId}]`);
      
      const orgData = await this.organizationLookupService.findOrganizationByBUName(businessUnitName);
      
      if (!orgData) {
        throw new HttpException(
          {
            error: 'Organização não encontrada',
            message: `A organização para a Business Unit "${businessUnitName}" não foi encontrada no Oracle Fusion.`,
            businessUnitName,
            suggestion: 'Verifique se o nome da Business Unit está correto.',
          },
          HttpStatus.NOT_FOUND,
        );
      }
      
      this.logger.log(`✅ Organização encontrada: ${orgData.organizationCode} (${orgData.businessUnitName}) [${operationId}]`);
      
      // 2. Validar que o item está associado à organização
      this.logger.log(`Validando item ${dto.itemNumber} na organização ${orgData.organizationCode} [${operationId}]`);
      
      const item = await this.itemLookupService.findItemByNumber(dto.itemNumber, orgData.organizationCode);
      
      if (!item) {
        throw new HttpException(
          {
            error: 'Item não habilitado para esta organização',
            message: `O item ${dto.itemNumber} não está associado à organização ${orgData.organizationCode}. ` +
                     `Para criar uma requisição de compra para "${orgData.businessUnitName}", ` +
                     `o item precisa estar habilitado para a organização de inventário correspondente.`,
            itemNumber: dto.itemNumber,
            organizationCode: orgData.organizationCode,
            businessUnitName: orgData.businessUnitName,
            suggestion: 'Verifique se o item foi associado à organização de inventário correspondente.',
          },
          HttpStatus.FORBIDDEN,
        );
      }
      
      this.logger.log(`✅ Item ${dto.itemNumber} habilitado (ItemId: ${item.ItemId}) [${operationId}]`);

      // 3. Preparar o payload da Purchase Requisition com dados corretos
      const payload = this.buildPurchaseRequisitionPayload(dto, item, orgData, operationId);

      // 4. Criar a Purchase Requisition na Oracle
      const authHeader = this.authService.getBasicAuthHeader();
      const url = `${this.baseUrl}/fscmRestApi/resources/${this.apiVersion}/purchaseRequisitions`;

      this.logger.log(`Criando Purchase Requisition na Oracle: ${url} [${operationId}]`);
      this.logger.log(`Payload: ${JSON.stringify(payload, null, 2).substring(0, 500)}... [${operationId}]`);

      const response = await this.axiosInstance.post(url, payload, { 
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      this.logger.log(`Purchase Requisition criada com sucesso: ${response.data.Requisition} (ID: ${response.data.RequisitionHeaderId}) [${operationId}]`);

      const requisitionId = response.data.RequisitionHeaderId;
      const requisitionNumber = response.data.Requisition;

      // 5. Atualizar DFFs APÓS a criação da requisição
      // NOTA: ChargeAccount agora é incluído diretamente no payload inicial
      // Apenas atualizamos os DFFs (Centro de Custo, Projeto, Classe Financeira)
      if (response.data.lines && response.data.lines[0]) {
        const line = response.data.lines[0];
        const lineId = line.RequisitionLineId;
        
        if (line.distributions && line.distributions[0]) {
          const distribution = line.distributions[0];
          const distributionId = distribution.RequisitionDistributionId;
          
          // Atualizar DFF (Centro de Custo e Projeto) se fornecidos
          if (dto.costCenter && dto.project) {
            this.logger.log(`📝 Atualizando DFFs na distribuição (CC, Projeto${dto.financialClass ? ', Classe Financeira' : ''}) [${operationId}]`);
            
            try {
              await this.fusionService.updateDistributionDFF(
                String(requisitionId),
                String(lineId),
                String(distributionId),
                dto.costCenter,
                dto.project,
                dto.financialClass,
              );
              this.logger.log(`✅ DFFs atualizados com sucesso [${operationId}]`);
            } catch (updateError) {
              this.logger.warn(`⚠️  Erro ao atualizar Centro de Custo e Projeto: ${updateError.message} [${operationId}]`);
              this.logger.warn(`   A requisição foi criada, mas os campos de "Additional Information" podem estar vazios`);
            }
          }
        }
      }

      // Auto-submit: Submete automaticamente para aprovação após criação
      const shouldAutoSubmit = dto.autoSubmit !== false; // Default: true
      let submissionResult = null;
      let submissionError = null;

      if (shouldAutoSubmit) {
        this.logger.log(`🚀 Submetendo automaticamente para aprovação [${operationId}]`);
        
        try {
          submissionResult = await this.fusionService.submitRequisition(String(requisitionId));
          this.logger.log(`✅ Requisição ${requisitionNumber} submetida automaticamente para aprovação [${operationId}]`);
        } catch (submitError) {
          // Extrair detalhes completos do erro
          const errorDetails = submitError.response?.message || submitError.message;
          const errorData = submitError.response?.details || null;
          
          submissionError = errorDetails;
          
          this.logger.error(`⚠️  Erro ao submeter automaticamente [${operationId}]`);
          this.logger.error(`   Mensagem: ${errorDetails}`);
          
          if (errorData) {
            this.logger.error(`   Detalhes Oracle: ${JSON.stringify(errorData, null, 2)}`);
          }
          
          // Não falhar a requisição inteira, apenas logar o erro
          // A requisição foi criada com sucesso, apenas a submissão falhou
        }
      } else {
        this.logger.log(`⏸️  Auto-submit desabilitado - requisição criada mas não submetida [${operationId}]`);
      }

      return {
        operationId,
        success: true,
        ticket: dto.ticket,
        requisition: {
          requisitionNumber,
          requisitionId,
          status: submissionResult ? 'Pending Approval' : response.data.DocumentStatus,
          statusCode: submissionResult ? 'PENDING_APPROVAL' : response.data.DocumentStatusCode,
          businessUnit: response.data.RequisitioningBU,
          preparer: response.data.Preparer,
          description: response.data.Description,
          createdDate: response.data.CreationDate,
          autoSubmitted: shouldAutoSubmit,
          submissionSuccess: shouldAutoSubmit && !submissionError,
          submissionError: submissionError,
        },
        oracleResponse: response.data,
      };

    } catch (error) {
      // Extrair detalhes do erro da Oracle
      const oracleError = error.response?.data;
      const errorDetails = JSON.stringify(oracleError, null, 2);
      
      this.logger.error(`Erro ao criar Purchase Requisition - Ticket: ${dto.ticket} - ${error.message} [${operationId}]`);
      this.logger.error(`Detalhes do erro Oracle: ${errorDetails} [${operationId}]`);
      
      throw new HttpException(
        {
          operationId,
          success: false,
          ticket: dto.ticket,
          error: error.message,
          oracleError: oracleError || null,
          details: oracleError?.detail || oracleError?.title || 'Erro ao criar requisição de compras',
        },
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Constrói o payload da Purchase Requisition
   * 
   * IMPORTANTE: Usa dados da OrganizationData para garantir que o
   * RequisitioningBU tenha o nome COMPLETO da Business Unit.
   * 
   * Exemplo: "B10180 BILD 10 DESENVOLVI" (correto)
   * Não: "OI_B10180" (errado - código da organização)
   */
  private buildPurchaseRequisitionPayload(
    dto: CreatePurchaseRequisitionDto,
    item: any,
    orgData: any,
    operationId: string,
  ): any {
    // Converter preço de string para número (trocar vírgula por ponto)
    const price = parseFloat(dto.price.replace(',', '.'));
    const quantity = dto.quantity || 1;
    const uom = dto.uom || item.PrimaryUOM || 'UN';
    const currencyCode = dto.currencyCode || 'BRL';

    // Descrição: usar a do DTO, ou a descrição do item do Fusion, ou fallback para ticket
    // Prioridade: dto.description > item.Description > ticket
    const description = dto.description || item.Description || `Requisição Zeev Ticket: ${dto.ticket}`;
    
    this.logger.log(`📝 Descrição da requisição: ${description} [${operationId}]`);

    // Data de necessidade (se não informada, usar 30 dias a partir de hoje)
    const needByDate = dto.needByDate || this.getDefaultNeedByDate();

    this.logger.log(`Construindo payload - Item: ${item.ItemNumber}, Preço: ${price}, Quantidade: ${quantity}, UOM: ${uom} [${operationId}]`);
    this.logger.log(`📋 Dados recebidos do DTO - accountNumber: ${dto.accountNumber}, costCenter: ${dto.costCenter}, project: ${dto.project}, financialClass: ${dto.financialClass} [${operationId}]`);

    // Email do requester (usa o fornecido ou padrão)
    const requesterEmail = dto.requesterEmail || 'automacao.csc@bild.com.br';

    // Payload corrigido baseado nos erros documentados
    const deliverToLocationCode = dto.deliveryLocation || orgData.locationCode;

    const payload = {
      // === CABEÇALHO ===
      // Usar RequisitioningBU com o nome COMPLETO da Business Unit
      // Ex: "B10180 BILD 10 DESENVOLVI" e não "OI_B10180"
      RequisitioningBU: orgData.businessUnitName,
      
      // Usar PreparerEmail ao invés de PreparerId
      // IMPORTANTE: O PreparerEmail DEVE ser o mesmo usuário que está autenticado na API
      // Oracle exige: "The preparer and the signed-in user must be the same" (POR-2010915)
      // REQUISITO: O usuário automacao.csc@bild.com.br DEVE ter preferências configuradas
      // para TODAS as Business Units no Oracle Fusion
      PreparerEmail: 'automacao.csc@bild.com.br',
      
      // Descrição
      Description: description,
      
      // Flag de gerenciamento externo
      ExternallyManagedFlag: false,
      
      // === LINHAS ===
      lines: [
        {
          // Número da linha
          LineNumber: 1,
          
          // Tipo de linha (Goods ou Services)
          LineTypeCode: 'Goods',
          
          // ITEM - Usar ItemId ao invés de ItemNumber
          ItemId: item.ItemId,
          ItemDescription: item.Description || dto.itemNumber,
          
          // QUANTIDADE E PREÇO
          Quantity: quantity,
          UOM: uom,
          Price: price,
          CurrencyCode: currencyCode,
          
          // ENTREGA - Usar RequestedDeliveryDate ao invés de NeedByDate
          RequestedDeliveryDate: needByDate,
          
          // Destination Type - Expense or Inventory
          DestinationTypeCode: 'EXPENSE',
          
          // ORGANIZAÇÃO DE DESTINO (onde o item será entregue)
          DestinationOrganizationId: orgData.organizationId,
          
          // LOCALIZAÇÃO DE ENTREGA
          // Enviar tanto o ID quanto o Code para garantir compatibilidade
          DeliverToLocationId: orgData.locationId,
          DeliverToLocationCode: deliverToLocationCode,
          
          // SOLICITANTE - RequesterEmail é obrigatório
          RequesterEmail: requesterEmail,
          
          // FORNECEDOR SUGERIDO - Usar formato completo "NOME - CNPJ"
          // NewSupplierFlag=true permite sugerir fornecedor sem cadastro prévio na BU
          ...(dto.supplierName && dto.supplierCNPJ && {
            NewSupplierFlag: true,
            SuggestedSupplier: `${dto.supplierName} - ${dto.supplierCNPJ}`,
            SuggestedSupplierSite: dto.supplierSite || dto.supplierCNPJ,
          }),
          
          // DISTRIBUIÇÕES CONTÁBEIS
          // ESTRATÉGIA: Incluir ChargeAccount DIRETAMENTE no payload inicial
          // Isso garante que o ChargeAccount seja enviado corretamente
          // A Variance Account será derivada pelo Fusion via TAB (se configurado)
          distributions: [
            {
              DistributionNumber: 1,
              Quantity: quantity,
              // Incluir ChargeAccount se tivermos os dados necessários
              ...(dto.accountNumber && dto.costCenter && dto.project && {
                ChargeAccount: this.buildChargeAccount(
                  orgData.businessUnitName,
                  dto.accountNumber,
                  dto.costCenter,
                  dto.project,
                  dto.financialClass,
                  operationId,
                ),
              }),
            },
          ],
          
          // NOTA/OBSERVAÇÃO - Usar NoteToBuyer ao invés de Note
          NoteToBuyer: `Ticket Zeev: ${dto.ticket} | Solicitante: ${dto.requester}`,
        },
      ],
    };

    // Log completo do payload antes de enviar
    this.logger.log(`📦 PAYLOAD COMPLETO ENVIADO AO FUSION [${operationId}]:`);
    this.logger.log(JSON.stringify(payload, null, 2));
    
    // Log específico das distribuições
    if (payload.lines && payload.lines[0] && payload.lines[0].distributions) {
      this.logger.log(`📊 DISTRIBUIÇÕES ENVIADAS [${operationId}]:`);
      payload.lines[0].distributions.forEach((dist: any, idx: number) => {
        this.logger.log(`   Distribution ${idx + 1}: ${JSON.stringify(dist, null, 2)}`);
      });
    } else {
      this.logger.warn(`⚠️  NENHUMA DISTRIBUIÇÃO ENCONTRADA NO PAYLOAD [${operationId}]`);
    }

    return payload;
  }

  /**
   * Retorna data padrão de necessidade (30 dias a partir de hoje)
   */
  private getDefaultNeedByDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Monta ChargeAccount no formato segmentado Oracle
   * 
   * ESTRATÉGIA ALTERADA: Baseado no erro FND_VS_VALUES_NOT_RELATED, a Classe Financeira
   * pode não ser válida para a Conta Contábil. Vamos montar SEM Classe Financeira primeiro,
   * deixando o Fusion usar o padrão ou derivar automaticamente.
   * 
   * Estrutura descoberta via interface Oracle Fusion:
   * EMPRESA.CONTA_CONTABIL.INTERCOMPANHIA.CENTRO_CUSTO.PROJETO.CLASSE_FIN.FUT1.FUT2
   * 
   * IMPORTANTE: Se a Classe Financeira causar erro de validação, usar "00000" (padrão)
   * 
   * @param businessUnitName Nome completo da BU (ex: "H70002 BIVI MATRIZ")
   * @param accountNumber Conta contábil (ex: "32102040021")
   * @param costCenter Centro de custo (ex: "CC0091")
   * @param project Projeto (ex: "PV0508")
   * @param financialClass Classe financeira (ex: "CF001") - opcional, NÃO usar se causar erro de validação
   * @param operationId ID da operação para logging
   * @returns ChargeAccount no formato segmentado
   */
  private buildChargeAccount(
    businessUnitName: string,
    accountNumber: string,
    costCenter: string,
    project: string,
    financialClass: string | undefined,
    operationId: string,
  ): string {
    // Extrair código da empresa do nome da BU (ex: "H70002 BIVI MATRIZ" -> "H70002")
    const empresa = businessUnitName.split(' ')[0];
    
    // ESTRATÉGIA: NÃO incluir Classe Financeira no ChargeAccount
    // O erro FND_VS_VALUES_NOT_RELATED indica que a combinação Conta Contábil + Classe Financeira
    // não é válida no Chart of Accounts. Vamos usar "00000" (padrão) e deixar o Fusion derivar.
    // A Classe Financeira continuará sendo salva no DFF para referência, mas não no ChargeAccount.
    const classeFin = '00000'; // Sempre usar padrão para evitar erro de validação
    
    // Montar ChargeAccount no formato segmentado
    // EMPRESA.CONTA_CONTABIL.INTERCOMPANHIA.CENTRO_CUSTO.PROJETO.CLASSE_FIN.FUT1.FUT2
    const chargeAccount = `${empresa}.${accountNumber}.000000.${costCenter}.${project}.${classeFin}.0.0`;
    
    this.logger.log(`📊 ChargeAccount montado: ${chargeAccount} [${operationId}]`);
    this.logger.log(`   ⚠️  Classe Financeira NÃO incluída no ChargeAccount (usando padrão 00000) [${operationId}]`);
    if (financialClass) {
      this.logger.log(`   ℹ️  Classe Financeira ${financialClass} será salva apenas no DFF (Additional Information) [${operationId}]`);
    }
    
    return chargeAccount;
  }

  /**
   * Busca uma Purchase Requisition por ID
   */
  async getPurchaseRequisition(requisitionId: number): Promise<any> {
    const operationId = `PR_GET_${Date.now()}`;
    
    this.logger.log(`Buscando Purchase Requisition ID: ${requisitionId} [${operationId}]`);

    try {
      const authHeader = this.authService.getBasicAuthHeader();
      const url = `${this.baseUrl}/fscmRestApi/resources/${this.apiVersion}/purchaseRequisitions/${requisitionId}`;

      const response = await this.axiosInstance.get(url, { 
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      this.logger.log(`Purchase Requisition encontrada: ${response.data.Requisition} [${operationId}]`);

      return response.data;

    } catch (error) {
      this.logger.error(`Erro ao buscar Purchase Requisition ID: ${requisitionId} - ${error.message} [${operationId}]`);
      
      if (error.response?.status === 404) {
        throw new HttpException(
          `Purchase Requisition com ID ${requisitionId} não encontrada`,
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        `Erro ao buscar Purchase Requisition: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Lista Purchase Requisitions com filtros
   */
  async listPurchaseRequisitions(limit: number = 25, offset: number = 0, filters?: any): Promise<any> {
    const operationId = `PR_LIST_${Date.now()}`;
    
    this.logger.log(`Listando Purchase Requisitions (limit: ${limit}, offset: ${offset}) [${operationId}]`);

    try {
      const authHeader = this.authService.getBasicAuthHeader();
      const url = `${this.baseUrl}/fscmRestApi/resources/${this.apiVersion}/purchaseRequisitions`;

      const params: any = {
        limit,
        offset,
      };

      // Adicionar filtros se fornecidos
      if (filters?.businessUnit) {
        params.q = `RequisitioningBU='${filters.businessUnit}'`;
      }

      const response = await this.axiosInstance.get(url, { 
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        params,
      });

      this.logger.log(`Purchase Requisitions listadas: ${response.data.items?.length || 0} itens [${operationId}]`);

      return {
        items: response.data.items || [],
        count: response.data.count,
        hasMore: response.data.hasMore,
        limit: response.data.limit,
        offset: response.data.offset,
      };

    } catch (error) {
      this.logger.error(`Erro ao listar Purchase Requisitions: ${error.message} [${operationId}]`);

      throw new HttpException(
        `Erro ao listar Purchase Requisitions: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Submete uma Purchase Requisition para aprovação
   * 
   * Endpoint Oracle: POST /purchaseRequisitions/{id}/action/submitRequisition
   * Documentação: https://docs.oracle.com/en/cloud/saas/procurement/24c/fapra/op-purchaserequisitions-purchaserequisitionsuniqid-action-submitrequisition-post.html
   * 
   * @param requisitionId ID da Purchase Requisition (RequisitionHeaderId)
   * @returns Resultado da submissão
   */
  async submitPurchaseRequisition(requisitionId: string): Promise<any> {
    const operationId = `PR_SUBMIT_${Date.now()}`;
    
    this.logger.log(`Submetendo Purchase Requisition ID: ${requisitionId} para aprovação [${operationId}]`);

    try {
      // Delegar para o FusionService que já tem a lógica implementada
      const result = await this.fusionService.submitRequisition(requisitionId);

      this.logger.log(`✅ Purchase Requisition ${requisitionId} submetida com sucesso [${operationId}]`);

      return {
        operationId,
        success: true,
        requisitionId,
        message: 'Requisição submetida para aprovação com sucesso',
        oracleResponse: result,
      };

    } catch (error) {
      this.logger.error(`❌ Erro ao submeter Purchase Requisition ID: ${requisitionId} - ${error.message} [${operationId}]`);

      throw new HttpException(
        {
          operationId,
          success: false,
          requisitionId,
          error: error.message,
          details: error.response?.data || null,
        },
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
