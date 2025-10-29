
# Oracle Fusion Purchase Requisition API

API completa para criação e gerenciamento de requisições de compra no Oracle Fusion, desenvolvida com NestJS. Esta solução substitui o processo de RPA por integração direta com as APIs REST do Oracle Fusion.

## 🚀 Funcionalidades

- ✅ **Processamento em Lotes**: Upload de arquivos CSV/XLSX com processamento assíncrono
- ✅ **Integração Oracle Fusion**: APIs REST oficiais para criação de requisições
- ✅ **DFF (Descriptive Flexfields)**: Preenchimento automático de Centro de Custo e Projeto em "Additional Information" 🆕
- ✅ **Deliver-To Location**: Suporte completo para LocationId e LocationCode 🆕
- ⚠️ **Submissão Manual**: Requisições devem ser submetidas manualmente no Oracle UI (API não suportada nesta instância)
- ✅ **Autenticação OAuth2**: Integração com Oracle IDCS/Identity Domain
- ✅ **Observabilidade**: Logs estruturados, métricas e health checks
- ✅ **Idempotência**: Controle de duplicatas via referências externas
- ✅ **Validação**: Validação completa de dados de entrada
- ✅ **Documentação**: Swagger UI integrado
- ✅ **Persistência**: PostgreSQL para controle de estado e auditoria

## 📋 Pré-requisitos

- Node.js 18+
- PostgreSQL 13+
- Redis 6+
- Acesso ao Oracle Fusion com APIs REST habilitadas
- Aplicação OAuth2 configurada no Oracle IDCS

## 🛠️ Instalação

### 1. Clone e instale dependências
```bash
git clone <repository-url>
cd fusion-requisition-api
npm install
```

### 2. Configure as variáveis de ambiente
```bash
cp env.example .env
# Edite o arquivo .env com suas configurações
```

### 3. Configure o banco de dados
```bash
# Inicie PostgreSQL e Redis
docker-compose up -d postgres redis

# Execute as migrações (automáticas em desenvolvimento)
npm run start:dev
```

### 4. Inicie a aplicação
```bash
# Desenvolvimento
npm run start:dev

# Produção
npm run build
npm run start:prod
```

## 📚 Documentação da API

Acesse a documentação interativa em: http://localhost:3000/docs

## 🔧 Configuração

### Variáveis de Ambiente Obrigatórias

```env
# Oracle Fusion
FUSION_BASE_URL=https://your-instance.oraclecloud.com
FUSION_REST_VERSION=11.13.18.05
EXTERNAL_REF_FIELD=ExternalReference

# OAuth2
OAUTH_TOKEN_URL=https://your-domain.identity.oraclecloud.com/oauth2/v1/token
OAUTH_CLIENT_ID=your-client-id
OAUTH_CLIENT_SECRET=your-client-secret

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=fusion_api
DB_PASSWORD=your-password
DB_DATABASE=fusion_requisitions

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Configuração OAuth2 no Oracle Fusion

1. Acesse o Oracle Cloud Console
2. Vá para Identity & Security > Identity
3. Crie uma nova "Confidential Application"
4. Configure os escopos necessários:
   - `urn:opc:idm:__myscopes__`
5. Adicione os privilégios de Procurement REST

## 📊 Endpoints Principais

### Purchase Requisitions (Recomendado)
- `POST /procurement/purchase-requisitions` - Criar requisição de compra
- `GET /procurement/purchase-requisitions/:id` - Consultar requisição
- `GET /procurement/purchase-requisitions` - Listar requisições
- `POST /procurement/purchase-requisitions/:id/submit` - **Submeter para aprovação** ⭐

### Requisições (Legacy)
- `POST /requisitions` - Criar requisição individual
- `POST /requisitions/bulk` - Processamento em lote síncrono
- `GET /requisitions/:id` - Consultar requisição
- `POST /requisitions/submit` - Submeter para aprovação

### Lotes
- `POST /batches` - Criar lote a partir de arquivo
- `GET /batches` - Listar lotes
- `GET /batches/:id` - Detalhes do lote
- `GET /batches/:id/metrics` - Métricas do lote
- `POST /batches/:id/retry` - Reprocessar falhas

### Ingestão
- `POST /ingestion/validate` - Validar arquivo sem processar
- `POST /ingestion/template` - Download do template CSV

### Observabilidade
- `GET /observability/health` - Health check
- `GET /observability/metrics` - Métricas do sistema

## 🎯 Exemplo de Uso com Auto-Submit

### Criar Purchase Requisition (submetida automaticamente)

```bash
curl -X POST http://localhost:3000/procurement/purchase-requisitions \
  -H "Content-Type: application/json" \
  -d '{
    "businessUnit": "V30326 TRINITA",
    "itemNumber": "ATF20477",
    "quantity": 1,
    "price": "100.50",
    "ticket": "TICKET001"
  }'
```

**Resposta (requisição já aprovada automaticamente):**
```json
{
  "success": true,
  "data": {
    "requisition": {
      "requisitionNumber": "V30326REQ-1001234",
      "status": "Pending Approval",
      "autoSubmitted": true,
      "submissionSuccess": true
    }
  }
}
```

**✨ Por padrão, a requisição é automaticamente submetida para aprovação!**

Para criar SEM submeter automaticamente, adicione `"autoSubmit": false` no body.

---

## 📤 Upload de Arquivo em Lote (NOVO!)

### Criar múltiplas requisições via arquivo Excel/CSV

**Endpoint:**
```
POST /procurement/purchase-requisitions/upload
```

**Formato do arquivo:**

| Coluna | Exemplo | Obrigatório |
|--------|---------|-------------|
| businessUnit | V30326 TRINITA | ✅ |
| requesterEmail | camila.americo@bild.com.br | ✅ |
| itemNumber | SVA20035 | ✅ |
| quantity | 1 | ✅ |
| price | 12400.4 | ✅ |
| ticket | ZEEV-001 | ✅ |
| accountNumber | 32102040021 | ✅ |
| costCenter | CC0091 | ✅ |
| project | PV0508 | ✅ |
| supplierCode | 65007 | ❌ |
| supplierCNPJ | 31303450000187 | ❌ |
| supplierName | FORNECEDOR LTDA | ❌ |
| description | Descrição customizada | ❌ |

**Exemplo de uso com cURL:**

```bash
curl -X POST http://localhost:3000/procurement/purchase-requisitions/upload \
  -F "file=@requisicoes.xlsx"
```

**Resposta (exemplo com 3 requisições):**

```json
{
  "success": true,
  "message": "Arquivo processado com sucesso",
  "data": {
    "totalProcessed": 3,
    "totalSuccess": 3,
    "totalErrors": 0,
    "results": [
      {
        "line": 2,
        "ticket": "ZEEV-001",
        "success": true,
        "requisitionNumber": "V30326REQ-1000632",
        "requisitionId": 300000508622418,
        "status": "Pending Approval"
      },
      {
        "line": 3,
        "ticket": "ZEEV-002",
        "success": true,
        "requisitionNumber": "V30326REQ-1000633",
        "requisitionId": 300000508622419,
        "status": "Pending Approval"
      },
      {
        "line": 4,
        "ticket": "ZEEV-003",
        "success": true,
        "requisitionNumber": "H70002REQ-1000634",
        "requisitionId": 300000508622420,
        "status": "Pending Approval"
      }
    ]
  }
}
```

**📥 Template de arquivo:**  
Disponível em: `docs/TEMPLATE_REQUISICOES_LOTE.csv`

**📚 Guia completo:**  
Consulte: `docs/GUIA_UPLOAD_ARQUIVO_LOTE.md`

---

## 📁 Formato de Arquivo (Sistema Antigo - Batches)

### Template CSV
```csv
business_unit,requester,deliver_to_location,external_reference,item_number,description,supplier_number,quantity,unit_price,cost_center,project_number,submit
BU001,user@company.com,LOC001,REF001,ITEM001,Office Supplies,SUP001,10,25.50,CC001,PROJ001,true
```

### JSON para API
```json
{
  "businessUnit": "BU001",
  "requesterUsernameOrEmail": "user@company.com",
  "deliverToLocation": "LOC001",
  "externalReference": "REF001",
  "lines": [
    {
      "itemNumber": "ITEM001",
      "description": "Office Supplies",
      "supplierNumber": "SUP001",
      "quantity": 10,
      "unitPrice": 25.50,
      "costCenter": "CC001",
      "projectNumber": "PROJ001"
    }
  ],
  "submit": true
}
```

## 🔄 Fluxo de Processamento

1. **Upload**: Arquivo CSV/XLSX é enviado via API
2. **Validação**: Dados são validados e normalizados
3. **Criação do Lote**: Batch é criado no banco de dados
4. **Processamento**: Jobs são enfileirados no Redis/BullMQ
5. **Integração**: Cada requisição é criada no Oracle Fusion
6. **Submissão**: Requisições são submetidas para aprovação
7. **Auditoria**: Status e resultados são persistidos

## 📈 Monitoramento

### Health Checks
- **Database**: Verificação de conectividade PostgreSQL
- **Redis**: Verificação de conectividade Redis
- **Fusion**: Verificação de autenticação OAuth2

### Métricas
- Total de lotes e requisições processadas
- Taxa de sucesso/falha
- Tempo médio de processamento
- Uso de memória e recursos

### Logs
- Logs estruturados com Pino
- Rastreamento de correlação por batch/requisition
- Logs de API do Fusion com timing
- Redação automática de dados sensíveis

## 🧪 Testes

```bash
# Testes unitários
npm run test

# Testes com coverage
npm run test:cov

# Testes e2e
npm run test:e2e
```

## 🚀 Deploy

### Docker
```bash
# Build da imagem
docker build -t fusion-requisition-api .

# Execução
docker run -p 3000:3000 --env-file .env fusion-requisition-api
```

### Docker Compose
```bash
# Iniciar todos os serviços
docker-compose up -d

# Logs
docker-compose logs -f app
```

## 📝 Licença

MIT License

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request

## 📖 Documentação Adicional

### Guias Disponíveis
- **[📚 Lições Aprendidas - Oracle Fusion API](docs/LICOES_APRENDIDAS_ORACLE_FUSION_API.md)** - Base de conhecimento completa 🆕⭐
- **[Como Gerar PDF](docs/COMO_GERAR_PDF.md)** - Converter para base vetorial PostgreSQL 🆕
- **[Status Final](docs/STATUS_FINAL.md)** - Status da integração 🆕
- **[Auto-Submit para Aprovação](docs/AUTO_SUBMIT_APROVACAO.md)** - Submissão automática ao criar PRs
- **[Guia de Submissão para Aprovação](docs/GUIA_SUBMISSAO_APROVACAO.md)** - Como submeter PRs e verificar na interface Oracle
- **[Arquitetura Final](docs/ARQUITETURA_FINAL.md)** - Documentação técnica completa
- **[Guia de Início Rápido](docs/GUIA_INICIO_RAPIDO.md)** - Setup em 5 minutos
- **[PRD](docs/PRD.md)** - Product Requirements Document

### Referências Técnicas
- **[Schema DFF Oracle](docs/DFF_SCHEMA_ORACLE.json)** - Schema completo dos DFFs do tenant

### Scripts de Exemplo
- **[Exemplo Auto-Submit](docs/EXEMPLO_AUTO_SUBMIT.sh)** - Demonstração de auto-submit
- **[Exemplo de Submissão Manual](docs/EXEMPLO_SUBMISSAO.sh)** - Script de teste manual

## 📞 Suporte

Para dúvidas ou problemas:
- Abra uma issue no repositório
- Consulte a documentação do Oracle Fusion REST APIs
- Verifique os logs da aplicação
