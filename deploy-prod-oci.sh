#!/bin/bash

set -e

# Configurações
COMPARTMENT_ID="ocid1.compartment.oc1..aaaaaaaa6c2vhi5f4f4lsz6h4y3qqhxuu3s3hh4tf4f3cmumuo65o3o2qoka"
SUBNET_ID="ocid1.subnet.oc1.sa-saopaulo-1.aaaaaaaa7ucdeyn72b4bgleiwbhmbtfqujzutttyb52jqgcncdw7w7h2snua"
AVAILABILITY_DOMAIN="iQRo:SA-SAOPAULO-1-AD-1"
PROJECT_NAME="purchase-oracle-integration-prod"
IMAGE_URL="sa-saopaulo-1.ocir.io/grzaximzipxi/purchase-oracle-integration-prod:v1.0.6"
NAMESPACE="grzaximzipxi"
OCI_USERNAME="automacao.csc@bild.com.br"

# Gerar credenciais base64
USERNAME_B64=$(printf "${NAMESPACE}/${OCI_USERNAME}" | base64)
PASSWORD_B64=$(base64 < ~/.oci/auth_token)

# Criar arquivo de secrets
SECRET_FILE=$(mktemp)
cat > "$SECRET_FILE" << SECRETS_EOF
[{
  "secret-type": "BASIC",
  "registry-endpoint": "sa-saopaulo-1.ocir.io",
  "username": "${USERNAME_B64}",
  "password": "${PASSWORD_B64}"
}]
SECRETS_EOF

echo "🚀 Criando Container Instance: ${PROJECT_NAME}..."

# Criar container instance
oci container-instances container-instance create \
  --compartment-id "${COMPARTMENT_ID}" \
  --availability-domain "${AVAILABILITY_DOMAIN}" \
  --shape "CI.Standard.E4.Flex" \
  --shape-config '{"ocpus":1,"memory-in-gbs":2.0}' \
  --display-name "${PROJECT_NAME}" \
  --containers '[{
    "display-name":"'"${PROJECT_NAME}"'",
    "image-url":"'"${IMAGE_URL}"'",
    "environment-variables":{
      "NODE_ENV":"production",
      "PORT":"8080",
      "FUSION_BASE_URL":"https://fa-evvi-saasfaprod1.fa.ocs.oraclecloud.com",
      "FUSION_REST_VERSION":"11.13.18.05",
      "FUSION_USERNAME":"automacao.csc@bild.com.br",
      "FUSION_PASSWORD":"7@Q45D!a231A",
      "EXTERNAL_REF_FIELD":"ExternalReference",
      "LOG_LEVEL":"info",
      "MAX_FILE_SIZE":"10485760",
      "MASTER_ORG_CODE":"ITEM_MESTRE"
    }
  }]' \
  --vnics '[{"subnet-id":"'"${SUBNET_ID}"'","is-public-ip-assigned":true}]' \
  --image-pull-secrets "file://$SECRET_FILE" \
  --container-restart-policy "ALWAYS"

rm -f "$SECRET_FILE"

echo "✅ Deploy iniciado com sucesso!"
echo ""
echo "⏳ Aguarde alguns minutos para a instância ficar ACTIVE"
echo ""
echo "Para verificar o status:"
echo "  oci container-instances container-instance list \\"
echo "    --compartment-id '${COMPARTMENT_ID}' \\"
echo "    --lifecycle-state ACTIVE"
