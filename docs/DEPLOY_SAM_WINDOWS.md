# 🚀 Deploy AWS SAM - Guia para Windows

**Sistema**: Windows PowerShell  
**Ferramenta**: AWS SAM CLI  
**Data**: 14/11/2025

---

## 📋 Pré-requisitos

### 1. Verificar Instalações

Abra o **PowerShell** e execute:

```powershell
# Verificar AWS CLI
aws --version
# Deve mostrar: aws-cli/2.x.x

# Verificar SAM CLI
sam --version
# Deve mostrar: SAM CLI, version 1.x.x

# Verificar Docker
docker --version
# Deve mostrar: Docker version 24.x.x
```

### 2. Instalar AWS SAM CLI (se necessário)

Se o comando `sam --version` não funcionar:

#### Opção A: Via MSI (Recomendado para Windows)

1. **Baixar SAM CLI**:
   - Acesse: https://aws.amazon.com/serverless/sam/
   - Ou baixe direto: https://github.com/aws/aws-sam-cli/releases/latest
   - Procure por: `AWSSAMCLI.msi` (Windows 64-bit)

2. **Instalar**:
   - Execute o arquivo `.msi` baixado
   - Siga o assistente de instalação
   - **IMPORTANTE**: Feche e reabra o PowerShell após instalar

3. **Verificar**:
   ```powershell
   sam --version
   ```

#### Opção B: Via Chocolatey (se você usa Chocolatey)

```powershell
choco install aws-sam-cli
```

### 3. Configurar AWS CLI

Se ainda não configurou:

```powershell
aws configure
```

Você precisará fornecer:
- **AWS Access Key ID**: Sua chave de acesso
- **AWS Secret Access Key**: Sua chave secreta
- **Default region name**: `us-east-1` (ou a região desejada)
- **Default output format**: `json`

---

## 🚀 Passo a Passo do Deploy

### Passo 1: Preparar o Ambiente

1. **Navegar para o diretório do projeto**:
   ```powershell
   cd C:\caminho\para\BILD_PURCHASE
   ```

2. **Verificar arquivos necessários**:
   ```powershell
   # Verificar se os arquivos existem
   Test-Path template.yaml
   Test-Path samconfig.toml
   Test-Path Dockerfile.lambda
   Test-Path src/lambda.ts
   ```

### Passo 2: Configurar Credenciais Oracle Fusion

1. **Editar `samconfig.toml`**:
   ```powershell
   notepad samconfig.toml
   ```

2. **Atualizar as variáveis** na seção `[default.deploy.parameters]`:
   ```toml
   parameter_overrides = [
     "FusionBaseUrl=https://fa-evvi-saasfaprod1.fa.ocs.oraclecloud.com",
     "FusionRestVersion=11.13.18.05",
     "FusionUsername=seu-usuario@bild.com.br",
     "FusionPassword=sua-senha-aqui",
     "ExternalRefField=ExternalReference"
   ]
   ```

   ⚠️ **IMPORTANTE**: Substitua `seu-usuario@bild.com.br` e `sua-senha-aqui` pelas credenciais reais!

3. **Salvar e fechar** o arquivo.

### Passo 3: Build da Imagem Docker

O SAM vai construir a imagem Docker e fazer push para o ECR automaticamente:

```powershell
# Build da imagem Docker (o SAM cria o repositório ECR automaticamente)
sam build --use-container
```

**Nota**: 
- O `--use-container` garante que o build seja feito em um container Docker, garantindo compatibilidade
- O SAM vai criar um repositório ECR temporário e fazer push da imagem automaticamente
- Isso pode levar 5-10 minutos na primeira vez

### Passo 4: Validar o Template SAM

Antes de fazer deploy, valide o template:

```powershell
sam validate
```

**Resultado esperado**: `Template is valid`

### Passo 5: Deploy para AWS

Execute o comando de deploy:

```powershell
sam deploy --guided
```

**Na primeira vez**, o SAM vai fazer perguntas. Responda:

1. **Stack Name**: `bild-purchase-api` (ou pressione Enter para usar o padrão)
2. **AWS Region**: `us-east-1` (ou sua região preferida)
3. **Confirm changes before deploy**: `Y` (recomendado)
4. **Allow SAM CLI IAM role creation**: `Y` (o SAM cria as roles necessárias)
5. **Disable rollback**: `N` (deixe habilitado para rollback em caso de erro)
6. **Save arguments to configuration file**: `Y` (salva no samconfig.toml)
7. **Image Repository for BildPurchaseApiFunction**: Deixe vazio (o SAM vai criar automaticamente)

**Nas próximas vezes**, você pode usar apenas:

```powershell
sam deploy
```

O SAM vai usar as configurações salvas no `samconfig.toml` e a imagem já estará no ECR.

### Passo 6: Aguardar o Deploy

O deploy pode levar **5-10 minutos** na primeira vez. Você verá:

```
Deploying with following values
===============================
Stack name                   : bild-purchase-api
Region                       : us-east-1
Confirm changeset            : True
Disable rollback             : False
...

Creating the required resources...
```

**Aguarde até ver**:
```
Successfully created/updated stack - bild-purchase-api
```

### Passo 7: Obter a URL da API

Após o deploy, o SAM vai mostrar os **Outputs**:

```
Outputs
--------------------------------------------------------------------------------------------------------
Key                 BildPurchaseApiFunctionApiUrl
Description         API Gateway endpoint URL
Value               https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/Prod
```

**OU** você pode obter a URL manualmente:

```powershell
# Obter a URL da API
aws cloudformation describe-stacks `
  --stack-name bild-purchase-api `
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
  --output text
```

---

## ✅ Testar a API

### 1. Health Check

```powershell
# Substitua YOUR_API_URL pela URL obtida no Passo 7
$apiUrl = "https://sua-url-aqui.lambda-url.us-east-1.on.aws"

curl -X GET "$apiUrl/observability/health"
```

**Resposta esperada**:
```json
{
  "status": "healthy",
  "checks": {
    "fusion": "healthy"
  },
  "timestamp": "2025-11-14T..."
}
```

### 2. Testar Upload de Arquivo XLSX

```powershell
# Substitua pelo caminho do seu arquivo
$filePath = "C:\caminho\para\req_teste_manu.xlsx"

curl -X POST "$apiUrl/procurement/purchase-requisitions/upload" `
  -F "file=@$filePath" `
  -H "Accept: application/json"
```

---

## 🔧 Comandos Úteis

### Ver Logs da Função Lambda

```powershell
sam logs -n BildPurchaseApiFunction --stack-name bild-purchase-api --tail
```

### Atualizar Apenas o Código (sem recriar a stack)

```powershell
# Build
sam build --use-container

# Deploy apenas a função
sam deploy
```

### Remover a Stack (Desfazer Deploy)

```powershell
sam delete --stack-name bild-purchase-api
```

**⚠️ ATENÇÃO**: Isso remove TODOS os recursos criados, incluindo a função Lambda e o repositório ECR!

### Listar Stacks Criadas

```powershell
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```

---

## 🐛 Troubleshooting

### Erro: "SAM CLI not found"

**Solução**: Instale o SAM CLI (veja Passo 2 dos Pré-requisitos)

### Erro: "Docker daemon is not running"

**Solução**: 
1. Abra o Docker Desktop
2. Aguarde até aparecer "Docker is running"
3. Execute o comando novamente

### Erro: "Access Denied" ao fazer deploy

**Solução**: Verifique suas credenciais AWS:
```powershell
aws sts get-caller-identity
```

Se não funcionar, reconfigure:
```powershell
aws configure
```

### Erro: "Image not found" durante deploy

**Solução**: O SAM precisa fazer build primeiro:
```powershell
sam build --use-container
sam deploy
```

### Erro: "Parameter validation failed"

**Solução**: Verifique se todas as variáveis no `samconfig.toml` estão preenchidas corretamente, especialmente `FusionUsername` e `FusionPassword`.

### Timeout durante deploy

**Solução**: Aumente o timeout no `template.yaml`:
```yaml
Globals:
  Function:
    Timeout: 300  # 5 minutos
```

---

## 📝 Estrutura de Arquivos

```
BILD_PURCHASE/
├── template.yaml          # Template SAM (infraestrutura)
├── samconfig.toml         # Configurações do SAM
├── Dockerfile.lambda      # Dockerfile para Lambda
├── src/
│   └── lambda.ts          # Handler Lambda
├── package.json
└── docs/
    └── DEPLOY_SAM_WINDOWS.md  # Este guia
```

---

## 🎯 Resumo Rápido

```powershell
# 1. Configurar credenciais no samconfig.toml
notepad samconfig.toml

# 2. Build e Deploy
sam build --use-container
sam deploy --guided

# 3. Obter URL
aws cloudformation describe-stacks --stack-name bild-purchase-api --query "Stacks[0].Outputs"

# 4. Testar
curl -X GET "SUA_URL/observability/health"
```

---

## 📚 Referências

- **AWS SAM CLI**: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-install.html
- **SAM Template Reference**: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-specification.html
- **AWS Lambda**: https://docs.aws.amazon.com/lambda/

---

## ✅ Checklist Final

- [ ] AWS CLI instalado e configurado
- [ ] SAM CLI instalado
- [ ] Docker Desktop instalado e rodando
- [ ] Credenciais Oracle Fusion configuradas no `samconfig.toml`
- [ ] Template validado (`sam validate`)
- [ ] Deploy realizado com sucesso
- [ ] URL da API obtida
- [ ] Health check funcionando
- [ ] Upload de arquivo testado

---

**Pronto!** Sua API está no ar! 🎉

