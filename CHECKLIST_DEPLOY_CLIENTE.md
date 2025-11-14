# ✅ Checklist de Deploy - Cliente AWS

## 📋 Pré-requisitos (Verificar antes de começar)

- [ ] **Conta AWS ativa** com acesso ao console
- [ ] **AWS CLI instalado** (versão 2.x)
  - Verificar: `aws --version` no PowerShell
  - Download: https://aws.amazon.com/cli/
- [ ] **Docker Desktop instalado e rodando**
  - Verificar: `docker --version` no PowerShell
  - Download: https://www.docker.com/products/docker-desktop/
- [ ] **Credenciais Oracle Fusion** disponíveis:
  - URL do Fusion (ex: `https://fa-evvi-saasfaprod1.fa.ocs.oraclecloud.com`)
  - Usuário técnico
  - Senha
- [ ] **Acesso ao repositório Git** ou arquivo ZIP do código

---

## 🚀 Passos do Deploy

### 1. Preparação do Ambiente
- [ ] Configurar AWS CLI (`aws configure`)
- [ ] Obter Account ID da AWS
- [ ] Clonar/extrair código do projeto

### 2. Configurar Credenciais Oracle
- [ ] Criar arquivo `lambda-env.json` (usar `lambda-env-template.json` como base)
- [ ] Preencher com credenciais reais do Oracle Fusion

### 3. Publicar Imagem Docker no ECR
- [ ] Criar repositório ECR
- [ ] Fazer login no ECR
- [ ] Build da imagem Docker (`Dockerfile.lambda`)
- [ ] Push da imagem para ECR

### 4. Criar Função Lambda
- [ ] Criar IAM Role para Lambda
- [ ] Criar função Lambda (usando imagem do ECR)
- [ ] Configurar variáveis de ambiente
- [ ] Configurar memória (2048 MB) e timeout (120s)

### 5. Expor API Publicamente
- [ ] Criar Function URL
- [ ] Configurar permissão pública (CORS)
- [ ] Copiar URL gerada

### 6. Testes
- [ ] Testar health check (`/observability/health`)
- [ ] Acessar Swagger UI (`/docs`)
- [ ] Criar uma Purchase Requisition de teste
- [ ] Verificar logs no CloudWatch

---

## 📝 Informações Importantes

**URL do Guia Completo**: `docs/DEPLOY_WINDOWS_POWERSHELL.md`

**Arquivos Necessários**:
- `Dockerfile.lambda` - Para build da imagem
- `lambda-env-template.json` - Template de variáveis de ambiente
- `package.json` - Dependências do projeto

**Tempo Estimado**: 30-40 minutos

**Suporte**: Em caso de dúvidas, consultar o guia completo em `docs/DEPLOY_WINDOWS_POWERSHELL.md`

