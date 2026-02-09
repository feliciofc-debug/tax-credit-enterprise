# 🏦 Tax Credit Recovery SaaS

Sistema SaaS para análise automatizada de DREs, Balanços e Balancetes com identificação de oportunidades de recuperação de créditos tributários usando Claude AI.

## 🚀 Funcionalidades

- ✅ Upload de documentos (PDF, Excel, TXT)
- ✅ Análise inteligente com Claude Opus 4.5
- ✅ Identificação de créditos tributários (IRPJ, CSLL, PIS, COFINS, ICMS, ISS)
- ✅ Estimativa de valores recuperáveis
- ✅ Fundamentação legal completa
- ✅ Avaliação de complexidade e probabilidade
- ✅ API REST completa
- ✅ Rate limiting e segurança

## 📋 Pré-requisitos

- Node.js 18+
- NPM ou Yarn
- API Key da Anthropic (Claude)

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone <seu-repo>
cd tax-credit-recovery-saas
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` e adicione sua API key:
```env
ANTHROPIC_API_KEY=sk-ant-api...
PORT=3000
```

4. Execute em desenvolvimento:
```bash
npm run dev
```

5. Build para produção:
```bash
npm run build
npm start
```

## 📡 API Endpoints

### Health Check
```bash
GET /api/health
GET /api/health/ready
```

### Análise Completa (Upload)
```bash
POST /api/analysis/upload
Content-Type: multipart/form-data

Campos:
- document: arquivo (PDF, Excel, TXT)
- documentType: "dre" | "balanço" | "balancete"
- companyName: string (opcional)
- cnpj: string (opcional)
- regime: "lucro_real" | "lucro_presumido" | "simples" (opcional)
```

Exemplo com cURL:
```bash
curl -X POST http://localhost:3000/api/analysis/upload \
  -F "document=@dre.pdf" \
  -F "documentType=dre" \
  -F "companyName=Empresa XYZ Ltda" \
  -F "cnpj=12.345.678/0001-90" \
  -F "regime=lucro_real"
```

### Análise de Texto Direto
```bash
POST /api/analysis/text
Content-Type: application/json

{
  "documentType": "dre",
  "documentText": "RECEITA BRUTA: R$ 10.000.000,00...",
  "companyInfo": {
    "name": "Empresa ABC",
    "cnpj": "12.345.678/0001-90",
    "regime": "lucro_real"
  }
}
```

### Análise Rápida (Sonnet - mais econômica)
```bash
POST /api/analysis/quick
Content-Type: multipart/form-data

Campos:
- document: arquivo
OU
- documentText: string
```

## 📊 Resposta da API

```json
{
  "success": true,
  "data": {
    "fileName": "dre_2024.pdf",
    "documentType": "dre",
    "analysis": {
      "oportunidades": [
        {
          "tipo": "Crédito PIS/COFINS sobre insumos",
          "descricao": "Possibilidade de creditamento de PIS/COFINS sobre insumos adquiridos...",
          "valorEstimado": 150000,
          "fundamentacaoLegal": "Lei 10.637/2002 e Lei 10.833/2003",
          "prazoRecuperacao": "Últimos 5 anos",
          "complexidade": "média",
          "probabilidadeRecuperacao": 85
        }
      ],
      "resumoExecutivo": "Identificadas 5 oportunidades de recuperação...",
      "valorTotalEstimado": 450000,
      "recomendacoes": [
        "Realizar levantamento detalhado das notas fiscais de insumos",
        "Consultar assessoria jurídica tributária"
      ],
      "alertas": [
        "Necessário comprovar essencialidade dos insumos"
      ]
    },
    "processedAt": "2024-02-07T10:30:00.000Z"
  }
}
```

## 🏗️ Estrutura do Projeto

```
src/
├── index.ts                    # Entry point
├── routes/
│   ├── analysis.routes.ts      # Rotas de análise
│   └── health.routes.ts        # Health checks
├── services/
│   ├── claude.service.ts       # Integração Claude API
│   └── documentProcessor.service.ts  # Processamento de arquivos
├── middleware/
│   └── errorHandler.ts         # Error handling
└── utils/
    └── logger.ts               # Winston logger

```

## 🔐 Segurança

- ✅ Helmet.js para headers de segurança
- ✅ Rate limiting (100 requests/15min por IP)
- ✅ Validação de tipos de arquivo
- ✅ Limite de tamanho de upload (10MB)
- ✅ Validação de dados com Zod
- ✅ CORS configurado

## 💰 Custos da API Claude

- **Claude Opus 4.5**: ~$15 por milhão de tokens de entrada, ~$75 por milhão de tokens de saída
- **Claude Sonnet 4.5**: ~$3 por milhão de tokens de entrada, ~$15 por milhão de tokens de saída

**Recomendação**: Use Opus para análises completas e complexas, Sonnet para análises rápidas.

## 🚦 Próximos Passos

### Backend
- [ ] Adicionar autenticação JWT
- [ ] Implementar banco de dados (PostgreSQL)
- [ ] Sistema de créditos/assinatura
- [ ] Histórico de análises por usuário
- [ ] Webhooks para notificações
- [ ] Cache de análises
- [ ] Exportação de relatórios (PDF)

### Frontend (Sugestão)
- [ ] Dashboard React/Next.js
- [ ] Upload drag-and-drop
- [ ] Visualização de oportunidades
- [ ] Gráficos de valores estimados
- [ ] Sistema de login/cadastro
- [ ] Gestão de documentos

### DevOps
- [ ] Docker e Docker Compose
- [ ] CI/CD Pipeline
- [ ] Deploy na AWS/GCP
- [ ] Monitoramento e logs
- [ ] Testes automatizados

## 📝 Exemplo de Uso

```typescript
// Cliente TypeScript
const formData = new FormData();
formData.append('document', file);
formData.append('documentType', 'dre');
formData.append('companyName', 'Minha Empresa');

const response = await fetch('http://localhost:3000/api/analysis/upload', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(`Oportunidades encontradas: ${result.data.analysis.oportunidades.length}`);
console.log(`Valor total estimado: R$ ${result.data.analysis.valorTotalEstimado}`);
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues e pull requests.

## 📄 Licença

MIT

## 🆘 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.

---

**Desenvolvido com ❤️ usando Claude AI**
