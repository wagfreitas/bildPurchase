# 🚀 Guia de Deploy - Cliente

Este guia explica como baixar e executar a API BILD Purchase Requisitions em seu ambiente (local ou AWS).

---

## 📦 Opção 1: Baixar Imagem Docker Pré-construída

### **Passo 1: Baixar a Imagem**

A imagem Docker está disponível em:
- **Docker Hub**: `bildpurchase/bild-purchase-requisitions:latest`
- **GitHub Container Registry**: (se configurado)

```bash
docker pull bildpurchase/bild-purchase-requisitions:latest
```

### **Passo 2: Configurar Variáveis de Ambiente**

Crie um arquivo `.env` com as configurações:

```env
# Oracle Fusion Configuration (OBRIGATÓRIO)
FUSION_BASE_URL=https://fa-evvi-test-saasfaprod1.fa.ocs.oraclecloud.com
FUSION_REST_VERSION=11.13.18.05
FUSION_USERNAME=automacao.csc@bild.com.br
FUSION_PASSWORD=sua_senha_aqui

# Application Configuration
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### **Passo 3: Executar o Container**

```bash
docker run -d \
  --name bild-purchase-api \
  -p 3000:3000 \
  --env-file .env \
  -v $(pwd)/uploads:/app/uploads \
  bildpurchase/bild-purchase-requisitions:latest
```

### **Passo 4: Verificar Saúde da API**

```bash
curl http://localhost:3000/observability/health
```

---

## 📦 Opção 2: Construir Imagem a Partir do Código

### **Passo 1: Clonar o Repositório**

```bash
git clone <url-do-repositorio>
cd BILD_PURCHASE
```

### **Passo 2: Construir a Imagem**

```bash
docker build -t bild-purchase-requisitions:latest .
```

Ou usando o script:

```bash
chmod +x scripts/build-docker.sh
./scripts/build-docker.sh v1.0.0
```

### **Passo 3: Executar**

```bash
docker run -d \
  --name bild-purchase-api \
  -p 3000:3000 \
  --env-file .env \
  bild-purchase-requisitions:latest
```

---

## 🐳 Opção 3: Docker Compose (Recomendado)

### **Passo 1: Preparar Ambiente**

Crie um arquivo `.env` com as variáveis necessárias:

```env
FUSION_BASE_URL=https://fa-evvi-test-saasfaprod1.fa.ocs.oraclecloud.com
FUSION_REST_VERSION=11.13.18.05
FUSION_USERNAME=automacao.csc@bild.com.br
FUSION_PASSWORD=sua_senha_aqui
NODE_ENV=production
PORT=3000
```

### **Passo 2: Executar com Docker Compose**

```bash
docker-compose -f docker-compose.production.yml up -d
```

### **Passo 3: Verificar Logs**

```bash
docker-compose -f docker-compose.production.yml logs -f app
```

---

## ☁️ Opção 4: Deploy na AWS

### **4.1. Amazon ECS (Elastic Container Service)**

#### **Pré-requisitos:**
- AWS CLI instalado e configurado
- Permissões para criar recursos ECS

#### **Passo 1: Criar Repositório ECR**

```bash
aws ecr create-repository --repository-name bild-purchase-requisitions --region us-east-1
```

#### **Passo 2: Autenticar no ECR**

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
```

#### **Passo 3: Fazer Push da Imagem**

```bash
docker tag bildpurchase/bild-purchase-requisitions:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/bild-purchase-requisitions:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/bild-purchase-requisitions:latest
```

#### **Passo 4: Criar Task Definition**

Crie um arquivo `task-definition.json`:

```json
{
  "family": "bild-purchase-requisitions",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "containerDefinitions": [
    {
      "name": "bild-purchase-api",
      "image": "<account-id>.dkr.ecr.us-east-1.amazonaws.com/bild-purchase-requisitions:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "FUSION_BASE_URL",
          "value": "https://fa-evvi-test-saasfaprod1.fa.ocs.oraclecloud.com"
        },
        {
          "name": "FUSION_REST_VERSION",
          "value": "11.13.18.05"
        },
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "FUSION_USERNAME",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:bild/fusion/username"
        },
        {
          "name": "FUSION_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:<account-id>:secret:bild/fusion/password"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/bild-purchase",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/observability/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3
      }
    }
  ]
}
```

#### **Passo 5: Registrar Task Definition**

```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

#### **Passo 6: Criar Serviço ECS**

```bash
aws ecs create-service \
  --cluster <nome-do-cluster> \
  --service-name bild-purchase-api \
  --task-definition bild-purchase-requisitions \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}"
```

---

### **4.2. AWS EC2 com Docker**

#### **Passo 1: Conectar na EC2**

```bash
ssh -i sua-chave.pem ec2-user@<ip-da-instancia>
```

#### **Passo 2: Instalar Docker**

```bash
sudo yum update -y
sudo yum install docker -y
sudo service docker start
sudo usermod -a -G docker ec2-user
```

#### **Passo 3: Baixar e Executar Imagem**

```bash
docker pull bildpurchase/bild-purchase-requisitions:latest

# Criar arquivo .env
cat > .env << EOF
FUSION_BASE_URL=https://fa-evvi-test-saasfaprod1.fa.ocs.oraclecloud.com
FUSION_REST_VERSION=11.13.18.05
FUSION_USERNAME=automacao.csc@bild.com.br
FUSION_PASSWORD=sua_senha
NODE_ENV=production
EOF

# Executar
docker run -d \
  --name bild-purchase-api \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  bildpurchase/bild-purchase-requisitions:latest
```

#### **Passo 4: Configurar Security Group**

No console AWS, adicione uma regra inbound no Security Group:
- **Porta**: 3000
- **Protocolo**: TCP
- **Origem**: Seu IP ou 0.0.0.0/0 (não recomendado para produção)

---

## 🔒 Segurança

### **Variáveis Sensíveis**

**NÃO** commite arquivos `.env` no repositório!

Use um gerenciador de secrets:
- **AWS**: Secrets Manager ou Parameter Store
- **Azure**: Key Vault
- **GCP**: Secret Manager
- **Kubernetes**: Secrets

### **Exemplo com AWS Secrets Manager**

```bash
# Criar secrets
aws secretsmanager create-secret \
  --name bild/fusion/username \
  --secret-string "automacao.csc@bild.com.br"

aws secretsmanager create-secret \
  --name bild/fusion/password \
  --secret-string "sua_senha"
```

---

## 📊 Monitoramento

### **Health Check**

A API expõe um endpoint de health check:

```bash
curl http://localhost:3000/observability/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2025-10-29T22:00:00.000Z"
}
```

### **Logs**

Visualizar logs do container:

```bash
docker logs -f bild-purchase-api
```

---

## 🆘 Troubleshooting

### **Container não inicia**

1. Verifique os logs:
   ```bash
   docker logs bild-purchase-api
   ```

2. Verifique variáveis de ambiente:
   ```bash
   docker exec bild-purchase-api env | grep FUSION
   ```

3. Teste conexão com Oracle:
   ```bash
   curl http://localhost:3000/procurement/purchase-requisitions/test-connection
   ```

### **Erro de permissão**

```bash
sudo chown -R $USER:$USER uploads/
```

### **Porta já em uso**

Altere a porta no comando docker run:
```bash
docker run -p 8080:3000 ...
```

---

## 📞 Suporte

Para questões ou problemas, entre em contato com a equipe de desenvolvimento.

---

**Última atualização**: Outubro 2025

