# 🚀 Guia Rápido de Deploy

Este é um guia rápido. Para instruções detalhadas, consulte [docs/GUIA_DEPLOY_CLIENTE.md](docs/GUIA_DEPLOY_CLIENTE.md).

---

## 🐳 Execução Rápida com Docker

### **1. Baixar Imagem**

```bash
docker pull bildpurchase/bild-purchase-requisitions:latest
```

### **2. Criar Arquivo `.env`**

```env
FUSION_BASE_URL=https://fa-evvi-test-saasfaprod1.fa.ocs.oraclecloud.com
FUSION_REST_VERSION=11.13.18.05
FUSION_USERNAME=automacao.csc@bild.com.br
FUSION_PASSWORD=sua_senha_aqui
NODE_ENV=production
PORT=3000
```

### **3. Executar**

```bash
docker run -d \
  --name bild-purchase-api \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  bildpurchase/bild-purchase-requisitions:latest
```

### **4. Verificar**

```bash
curl http://localhost:3000/observability/health
```

---

## 📦 Construir Imagem do Código

```bash
git clone <url-do-repositorio>
cd BILD_PURCHASE
chmod +x scripts/build-docker.sh
./scripts/build-docker.sh v1.0.0
```

---

## ☁️ Deploy na AWS

### **ECS Fargate (Recomendado)**

1. Fazer push para ECR:
```bash
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

docker tag bildpurchase/bild-purchase-requisitions:latest \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/bild-purchase-requisitions:latest

docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/bild-purchase-requisitions:latest
```

2. Criar Task Definition e Service no console AWS ECS

### **EC2 com Docker**

```bash
# Na EC2
docker pull bildpurchase/bild-purchase-requisitions:latest

docker run -d \
  --name bild-purchase-api \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  bildpurchase/bild-purchase-requisitions:latest
```

---

## 📚 Documentação Completa

- [Guia Completo de Deploy](docs/GUIA_DEPLOY_CLIENTE.md)
- [Documentação da API](README.md)
- [Swagger UI](http://localhost:3000/docs) (quando em execução)

---

## 🔒 Segurança

⚠️ **IMPORTANTE**: Nunca commite arquivos `.env` ou credenciais!

Use AWS Secrets Manager, Parameter Store ou similar para produção.

---

**Última atualização**: Outubro 2025

