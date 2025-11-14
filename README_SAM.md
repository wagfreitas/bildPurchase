# 🚀 Deploy com AWS SAM - Resumo Rápido

## 📋 Pré-requisitos

- ✅ AWS CLI instalado e configurado
- ✅ SAM CLI instalado
- ✅ Docker Desktop instalado e rodando

## 🚀 Comandos Rápidos

### 1. Configurar credenciais

Edite `samconfig.toml` e atualize:
- `FusionUsername`
- `FusionPassword`

### 2. Deploy

```powershell
# Build e Deploy
sam build --use-container
sam deploy --guided
```

### 3. Obter URL

```powershell
aws cloudformation describe-stacks `
  --stack-name bild-purchase-api `
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" `
  --output text
```

### 4. Testar

```powershell
$apiUrl = "SUA_URL_AQUI"
curl -X GET "$apiUrl/observability/health"
```

## 📚 Documentação Completa

Veja o guia completo em: `docs/DEPLOY_SAM_WINDOWS.md`

## 📁 Arquivos Importantes

- `template.yaml` - Template SAM (infraestrutura)
- `samconfig.toml` - Configurações do SAM
- `Dockerfile.lambda` - Dockerfile para Lambda
- `src/lambda.ts` - Handler Lambda

