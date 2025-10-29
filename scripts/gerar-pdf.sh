#!/bin/bash

# Script para gerar PDF da documentação de Lições Aprendidas
# Requer: pandoc e texlive-xetex instalados

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📄 Gerando PDF - Lições Aprendidas Oracle Fusion API${NC}"
echo ""

# Verificar se pandoc está instalado
if ! command -v pandoc &> /dev/null; then
    echo -e "${RED}❌ Erro: pandoc não está instalado${NC}"
    echo ""
    echo "Instale com:"
    echo "  macOS:   brew install pandoc"
    echo "  Ubuntu:  sudo apt-get install pandoc texlive-xetex"
    echo "  Windows: https://pandoc.org/installing.html"
    exit 1
fi

# Diretórios
DOCS_DIR="$(cd "$(dirname "$0")/../docs" && pwd)"
INPUT_FILE="$DOCS_DIR/LICOES_APRENDIDAS_ORACLE_FUSION_API.md"
OUTPUT_FILE="$DOCS_DIR/LICOES_APRENDIDAS_ORACLE_FUSION_API.pdf"

# Verificar se arquivo fonte existe
if [ ! -f "$INPUT_FILE" ]; then
    echo -e "${RED}❌ Erro: Arquivo fonte não encontrado${NC}"
    echo "   $INPUT_FILE"
    exit 1
fi

echo -e "📖 Arquivo fonte: $INPUT_FILE"
echo -e "📄 Arquivo destino: $OUTPUT_FILE"
echo ""

# Gerar PDF com pandoc
echo -e "${YELLOW}⚙️  Convertendo Markdown para PDF...${NC}"
pandoc "$INPUT_FILE" \
    -o "$OUTPUT_FILE" \
    --pdf-engine=xelatex \
    --toc \
    --toc-depth=2 \
    --number-sections \
    -V geometry:margin=1in \
    -V fontsize=11pt \
    -V documentclass=article \
    -V classoption=oneside \
    -V papersize=a4 \
    --highlight-style=tango \
    2>&1

# Verificar se foi criado com sucesso
if [ $? -eq 0 ] && [ -f "$OUTPUT_FILE" ]; then
    FILE_SIZE=$(ls -lh "$OUTPUT_FILE" | awk '{print $5}')
    echo ""
    echo -e "${GREEN}✅ PDF gerado com sucesso!${NC}"
    echo -e "   📄 Arquivo: $OUTPUT_FILE"
    echo -e "   💾 Tamanho: $FILE_SIZE"
    echo ""
    echo -e "${GREEN}🎉 Pronto para importar na base vetorial!${NC}"
else
    echo ""
    echo -e "${RED}❌ Erro ao gerar PDF${NC}"
    echo ""
    echo "Alternativas:"
    echo "  1. Use VS Code com extensão 'Markdown PDF'"
    echo "  2. Use ferramentas online: https://www.markdowntopdf.com/"
    echo "  3. Instale texlive-xetex: brew install --cask mactex (macOS)"
    exit 1
fi

