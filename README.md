
# Oracle Fusion Purchase Requisition API

API completa para criação e gerenciamento de requisições de compra no Oracle Fusion, desenvolvida com NestJS. Esta solução substitui o processo de RPA por integração direta com as APIs REST do Oracle Fusion.

## 🚀 Funcionalidades

- ✅ **Processamento em Lotes**: Upload de arquivos CSV/XLSX com processamento assíncrono
- ✅ **Integração Oracle Fusion**: APIs REST oficiais para criação de requisições
- ✅ **DFF (Descriptive Flexfields)**: Preenchimento automático de Centro de Custo e Projeto em "Additional Information" 🆕
- ✅ **Deliver-To Location**: Suporte completo para LocationId e LocationCode 🆕
- ⚠️ **Submissão Manual**: Requisições devem ser submetidas manualmente no Oracle UI (API não suportada nesta instância)
- ✅ **Autenticação Basic**: Usuário e senha do Oracle Fusion (Authorization: Basic)
- ✅ **Observabilidade**: Logs estruturados em arquivo (JSONL), métricas e health checks
- ✅ **Idempotência**: Controle de duplicatas via referências externas
- ✅ **Validação**: Validação completa de dados de entrada
- ✅ **Documentação**: Swagger UI integrado
 

## 📋 Pré-requisitos

- Node.js 18+
 
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

# Autenticação Basic (Oracle Fusion)
FUSION_USERNAME=your-fusion-username
FUSION_PASSWORD=your-fusion-password

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

### Credenciais para Autenticação Basic

1. Crie/solicite um usuário técnico no Oracle Fusion com permissão de acesso às APIs de Procurement.
2. Configure `FUSION_USERNAME` e `FUSION_PASSWORD` no `.env`.
3. Garanta que o usuário possui privilégios para criar e (se habilitado) submeter requisições.

## 📊 Endpoints Principais

### Purchase Requisitions (Recomendado)
- `POST /procurement/purchase-requisitions` - Criar requisição de compra
- `GET /procurement/purchase-requisitions/:id` - Consultar requisição
- `GET /procurement/purchase-requisitions` - Listar requisições
- `POST /procurement/purchase-requisitions/:id/submit` - **Submeter para aprovação** ⭐

 

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

 

---

 

## 🔄 Fluxo de Processamento

1. **Upload**: Arquivo CSV/XLSX é enviado via API
2. **Validação**: Dados são validados e normalizados
3. **Integração**: Cada requisição é criada no Oracle Fusion
4. **Submissão**: Requisições são submetidas para aprovação (quando aplicável)
5. **Logs**: Todas as requisições e respostas são registradas em `logs/app.log`

## 📈 Monitoramento

### Health Checks
- **Fusion**: Verificação de autenticação Basic

### Métricas
- Total de lotes e requisições processadas
- Taxa de sucesso/falha
- Tempo médio de processamento
- Uso de memória e recursos

### Logs
- Logs JSONL gravados em `logs/app.log`
- Interceptor global registra request, response (status, duração) e erros

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
