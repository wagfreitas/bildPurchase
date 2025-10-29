# 📁 Guia de Upload de Arquivo para Criar Requisições em Lote

**Data:** 10/10/2025  
**Versão:** 1.0

---

## 📋 Visão Geral

Este guia explica como a cliente pode enviar um arquivo (Excel ou CSV) com múltiplas requisições para serem criadas automaticamente no Oracle Fusion.

---

## 📊 Formato do Arquivo

### **Opção 1: Excel (.xlsx) - Recomendado**

Colunas obrigatórias:

| Coluna | Exemplo | Obrigatório | Descrição |
|--------|---------|-------------|-----------|
| `businessUnit` | V30326 TRINITA | ✅ | Nome completo da Business Unit |
| `requesterEmail` | camila.americo@bild.com.br | ✅ | Email do solicitante |
| `itemNumber` | SVA20035 | ✅ | Código do item |
| `quantity` | 1 | ✅ | Quantidade |
| `price` | 12400.4 | ✅ | Preço unitário |
| `ticket` | ZEEV-001 | ✅ | Ticket Zeev (controle) |
| `accountNumber` | 32102040021 | ✅ | Conta contábil |
| `costCenter` | CC0091 | ✅ | Centro de custo |
| `project` | PV0508 | ✅ | Projeto |
| `supplierCode` | 65007 | ❌ | Código do fornecedor (opcional) |
| `supplierCNPJ` | 31303450000187 | ❌ | CNPJ do fornecedor (opcional) |
| `supplierName` | FORNECEDOR LTDA | ❌ | Nome do fornecedor (opcional) |
| `supplierSite` | 31303450000187 | ❌ | Site do fornecedor (opcional) |
| `description` | Descrição do item | ❌ | Descrição customizada (opcional) |
| `needByDate` | 2025-11-30 | ❌ | Data necessária (opcional) |
| `uom` | UN | ❌ | Unidade de medida (opcional) |

### **Exemplo de Arquivo Excel:**

| businessUnit | requesterEmail | itemNumber | quantity | price | ticket | accountNumber | costCenter | project | supplierCode |
|--------------|----------------|------------|----------|-------|--------|---------------|------------|---------|--------------|
| V30326 TRINITA | camila.americo@bild.com.br | SVA20035 | 1 | 12400.4 | ZEEV-001 | 32102040021 | CC0091 | PV0508 | 65007 |
| V30326 TRINITA | camila.americo@bild.com.br | SVA20035 | 2 | 10500.0 | ZEEV-002 | 32102040021 | CC0091 | PV0508 | 65007 |
| H70002 BIVI MATRIZ | joao.silva@bild.com.br | ATF20477 | 5 | 250.75 | ZEEV-003 | 32103010011 | CC0057 | PC0041 | 65008 |

---

### **Opção 2: CSV**

Mesmo formato, separado por vírgula:

```csv
businessUnit,requesterEmail,itemNumber,quantity,price,ticket,accountNumber,costCenter,project,supplierCode
V30326 TRINITA,camila.americo@bild.com.br,SVA20035,1,12400.4,ZEEV-001,32102040021,CC0091,PV0508,65007
V30326 TRINITA,camila.americo@bild.com.br,SVA20035,2,10500.0,ZEEV-002,32102040021,CC0091,PV0508,65007
H70002 BIVI MATRIZ,joao.silva@bild.com.br,ATF20477,5,250.75,ZEEV-003,32103010011,CC0057,PC0041,65008
```

---

## 🚀 Como Enviar o Arquivo

### **Endpoint:**
```
POST /procurement/purchase-requisitions/upload
```

### **Método 1: Via cURL**

```bash
curl -X POST http://localhost:3000/procurement/purchase-requisitions/upload \
  -F "file=@requisicoes.xlsx"
```

### **Método 2: Via Postman**

1. Abra Postman
2. Crie nova requisição POST
3. URL: `http://localhost:3000/procurement/purchase-requisitions/upload`
4. Aba "Body" → selecione "form-data"
5. Adicione chave: `file` (tipo: File)
6. Selecione o arquivo Excel/CSV
7. Clique "Send"

### **Método 3: Via Interface Web (Frontend)**

Se houver interface web, fazer upload do arquivo através dela.

### **Método 4: Teste Rápido (linha única)**

Para testar rapidamente com uma única requisição:

```bash
# 1. Crie um arquivo teste.csv
echo "businessUnit,requesterEmail,itemNumber,quantity,price,ticket,accountNumber,costCenter,project,supplierCode
V30326 TRINITA,camila.americo@bild.com.br,SVA20035,1,12400.4,ZEEV-TEST-001,32102040021,CC0091,PV0508,65007" > teste.csv

# 2. Envie via cURL
curl -X POST http://localhost:3000/procurement/purchase-requisitions/upload \
  -F "file=@teste.csv"
```

---

## 📝 Resposta da API

### **Sucesso:**

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
        "line": 1,
        "ticket": "ZEEV-001",
        "success": true,
        "requisitionNumber": "V30326REQ-1000632",
        "requisitionId": 300000508622418,
        "status": "Pending Approval"
      },
      {
        "line": 2,
        "ticket": "ZEEV-002",
        "success": true,
        "requisitionNumber": "V30326REQ-1000633",
        "requisitionId": 300000508622419,
        "status": "Pending Approval"
      },
      {
        "line": 3,
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

### **Erro Parcial (algumas requisições falharam):**

```json
{
  "success": true,
  "message": "Arquivo processado com erros",
  "data": {
    "totalProcessed": 3,
    "totalSuccess": 2,
    "totalErrors": 1,
    "results": [
      {
        "line": 1,
        "ticket": "ZEEV-001",
        "success": true,
        "requisitionNumber": "V30326REQ-1000632"
      },
      {
        "line": 2,
        "ticket": "ZEEV-002",
        "success": false,
        "error": "Item SVA20999 não encontrado na organização"
      },
      {
        "line": 3,
        "ticket": "ZEEV-003",
        "success": true,
        "requisitionNumber": "H70002REQ-1000633"
      }
    ]
  }
}
```

---

## ⚙️ Processamento

### **Fluxo:**

1. ✅ **Upload** - Arquivo é enviado via API
2. ✅ **Validação** - Dados são validados (formato, campos obrigatórios)
3. ✅ **Processamento** - Cada linha é processada individualmente
4. ✅ **Criação** - Requisições são criadas no Oracle Fusion
5. ✅ **Submissão** - Requisições são automaticamente submetidas para aprovação
6. ✅ **Resposta** - API retorna resultado de cada linha

### **Tempo Estimado:**

- **1-10 requisições:** ~30 segundos
- **11-50 requisições:** ~2-3 minutos
- **51-100 requisições:** ~5-8 minutos

---

## ⚠️ Regras e Validações

### **Validações Automáticas:**

1. ✅ **Business Unit** existe e está ativa
2. ✅ **Item** existe na organização
3. ✅ **Requester** (solicitante) existe no Oracle
4. ✅ **Centro de Custo** é válido
5. ✅ **Projeto** é válido
6. ✅ **Combinação ChargeAccount** é permitida
7. ✅ **Quantidade** > 0
8. ✅ **Preço** > 0

### **Se alguma validação falhar:**

- A linha é marcada como erro
- **NÃO bloqueia** as outras linhas
- Erro é detalhado na resposta
- Cliente pode corrigir e reenviar apenas as linhas com erro

---

## 🔍 Verificar Requisições Criadas

### **No Oracle Fusion UI:**

1. Login no Oracle Fusion
2. Navegue: **Procurement → Purchase Requisitions**
3. Filtre por:
   - **Creation Date:** Hoje
   - **Preparer:** AUTOMACAO CSC-RPA
   - **Status:** Pending Approval

### **Via API:**

```bash
curl -X GET "http://localhost:3000/procurement/purchase-requisitions?date=2025-10-10"
```

---

## 📊 Template de Arquivo

### **Download Template:**

**Arquivo:** `docs/TEMPLATE_REQUISICOES_LOTE.xlsx`

**Ou crie manualmente com as colunas:**

```
businessUnit | requesterEmail | itemNumber | quantity | price | ticket | accountNumber | costCenter | project
```

---

## 🚨 Erros Comuns

### **Erro 1: "No file uploaded"**

**Causa:** Arquivo não foi enviado ou chave está errada  
**Solução:** Certifique-se que a chave do form-data é `file`

### **Erro 2: "Invalid file format"**

**Causa:** Arquivo não é .xlsx ou .csv  
**Solução:** Use apenas Excel (.xlsx) ou CSV (.csv)

### **Erro 3: "Missing required fields"**

**Causa:** Colunas obrigatórias faltando  
**Solução:** Verifique se todas as colunas obrigatórias estão presentes

### **Erro 4: "Item not found"**

**Causa:** Código do item não existe na organização  
**Solução:** Valide o código do item no Oracle antes de enviar

### **Erro 5: "Invalid ChargeAccount combination"**

**Causa:** Combinação de Centro de Custo + Projeto não é permitida  
**Solução:** Valide a combinação no Oracle UI primeiro

---

## 📞 Suporte

Para dúvidas ou problemas:

1. **Logs detalhados:** Checar resposta da API
2. **Validar dados:** Antes de enviar, validar no Oracle UI
3. **Reprocessar:** Corrigir linhas com erro e reenviar

---

## 🎯 Checklist

Antes de enviar o arquivo:

- [ ] Arquivo está em formato .xlsx ou .csv
- [ ] Primeira linha contém os nomes das colunas
- [ ] Todas as colunas obrigatórias estão presentes
- [ ] Business Units estão escritas corretamente (nome completo)
- [ ] Emails dos solicitantes estão corretos
- [ ] Códigos dos itens existem no Oracle
- [ ] Quantidades > 0
- [ ] Preços > 0
- [ ] Tickets Zeev são únicos (sem duplicatas)

---

**Integração pronta para uso! 🚀**

**Qualquer dúvida, consulte a equipe de desenvolvimento.**

