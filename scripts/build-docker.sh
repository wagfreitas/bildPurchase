#!/bin/bash

# Script para construir e publicar imagem Docker
# Uso: ./scripts/build-docker.sh [versão] [registry]

set -e

# Configurações padrão
DEFAULT_VERSION="latest"
DEFAULT_REGISTRY="bildpurchase"
IMAGE_NAME="bild-purchase-requisitions"

# Parâmetros
VERSION=${1:-$DEFAULT_VERSION}
REGISTRY=${2:-$DEFAULT_REGISTRY}
FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${VERSION}"

echo "🐳 Construindo imagem Docker..."
echo "   Nome: ${FULL_IMAGE_NAME}"
echo ""

# Build da imagem
docker build -t ${FULL_IMAGE_NAME} -t ${REGISTRY}/${IMAGE_NAME}:latest .

echo ""
echo "✅ Imagem construída com sucesso!"
echo ""
echo "📦 Para salvar a imagem localmente:"
echo "   docker save ${FULL_IMAGE_NAME} | gzip > ${IMAGE_NAME}-${VERSION}.tar.gz"
echo ""
echo "📥 Para carregar a imagem em outra máquina:"
echo "   gunzip -c ${IMAGE_NAME}-${VERSION}.tar.gz | docker load"
echo ""
echo "🚀 Para publicar no Docker Hub:"
echo "   docker login"
echo "   docker push ${FULL_IMAGE_NAME}"
echo "   docker push ${REGISTRY}/${IMAGE_NAME}:latest"
echo ""
echo "☁️  Para AWS ECR:"
echo "   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com"
echo "   docker tag ${FULL_IMAGE_NAME} <account-id>.dkr.ecr.us-east-1.amazonaws.com/${IMAGE_NAME}:${VERSION}"
echo "   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/${IMAGE_NAME}:${VERSION}"

