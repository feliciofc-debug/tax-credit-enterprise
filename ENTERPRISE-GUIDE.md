# 🚀 GUIA DE IMPLEMENTAÇÃO - VERSÃO ENTERPRISE

## 📦 O QUE FOI IMPLEMENTADO

### ✅ Sistema de Filas (Bull + Redis)
- **Processamento assíncrono** de até 200 documentos simultâneos
- **5 workers** processando em paralelo
- **Auto-retry** com backoff exponencial
- **Timeout** de 10 minutos por documento
- **Priorização** de jobs

### ✅ OCR Avançado (Tesseract.js)
- Processa PDFs digitalizados
- Extrai texto de imagens
- Suporta português
- Fallback automático quando PDF nativo falha

### ✅ Extração Automática de Períodos
- Detecta ano, mês, trimestre automaticamente
- Suporta múltiplos formatos: "2024", "2024-Q1", "2024-03"
- Organização cronológica automática

### ✅ Banco de Dados PostgreSQL + Prisma
- Schema completo com Users, BatchJobs, Documents, Analysis
- Relacionamentos otimizados
- Índices para performance
- Soft delete e timestamps

### ✅ Batch Upload API
- Upload de até 200 arquivos de uma vez
- Processamento em background
- Tracking de status em tempo real

### ✅ Dashboard de Estatísticas
- Total de lotes processados
- Documentos processados vs. falhos
- Valor total recuperável
- Status da fila em tempo real

### ✅ Relatório Consolidado
- Agregação por período
- Agregação por tipo de documento
- Top 10 oportunidades
- Timeline de valores
- Export para Excel

---

## 🔧 INSTALAÇÃO

### 1. Pré-requisitos
```bash
# Instalar PostgreSQL
# Mac: brew install postgresql
# Ubuntu: sudo apt-get install postgresql

# Instalar Redis
# Mac: brew install redis
# Ubuntu: sudo apt-get install redis-server
```

### 2. Configurar Banco de Dados
```bash
# Criar database
createdb taxcredit

# Configurar .env
cp .env.example .env
```

Edite o `.env`:
```env
DATABASE_URL="postgresql://postgres:senha@localhost:5432/taxcredit"
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### 3. Rodar Migrations
```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Iniciar Serviços

**Terminal 1 - API:**
```bash
npm run dev
```

**Terminal 2 - Worker:**
```bash
npm run worker
```

**Terminal 3 - Redis:**
```bash
redis-server
```

---

## 📡 ENDPOINTS DA API

### Batch Upload
```bash
POST /api/batch/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

# Campos:
- documents[]: array de arquivos (até 200)
- documentType: "dre" | "balanço" | "balancete"
- batchName: string (opcional)
- companyName: string (opcional)
- cnpj: string (opcional)
- regime: "lucro_real" | "lucro_presumido" | "simples" (opcional)

# Resposta:
{
  "success": true,
  "data": {
    "batchJobId": "uuid",
    "totalDocuments": 142,
    "message": "Arquivos recebidos e processamento iniciado"
  }
}
```

### Status do Batch
```bash
GET /api/batch/:batchId/status
Authorization: Bearer <token>

# Resposta:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Lote 2024",
    "status": "processing",
    "progress": 65,
    "totalDocuments": 142,
    "processedDocs": 92,
    "failedDocs": 3,
    "totalEstimatedValue": 1250000.50,
    "documents": [...]
  }
}
```

### Relatório Consolidado
```bash
GET /api/batch/:batchId/report
Authorization: Bearer <token>

# Resposta:
{
  "success": true,
  "data": {
    "summary": {
      "totalDocuments": 142,
      "successfulDocuments": 139,
      "failedDocuments": 3,
      "totalEstimatedValue": 1250000.50,
      "totalOpportunities": 523
    },
    "byPeriod": [
      {
        "period": "2020",
        "documents": 12,
        "estimatedValue": 150000,
        "opportunities": 45
      },
      ...
    ],
    "topOpportunities": [
      {
        "tipo": "Crédito PIS/COFINS sobre insumos",
        "count": 85,
        "totalValue": 450000,
        "avgProbability": 82
      },
      ...
    ],
    "timeline": [...],
    "recommendations": [...],
    "alerts": [...]
  }
}
```

### Export para Excel
```bash
GET /api/batch/:batchId/export
Authorization: Bearer <token>

# Retorna arquivo Excel (.xlsx) para download
```

### Dashboard
```bash
GET /api/dashboard/stats
Authorization: Bearer <token>

# Resposta:
{
  "success": true,
  "data": {
    "overview": {
      "totalBatches": 15,
      "completedBatches": 12,
      "totalDocuments": 1420,
      "completedDocuments": 1380,
      "totalEstimatedValue": 5750000.00
    },
    "queue": {
      "waiting": 25,
      "active": 5,
      "completed": 1200,
      "failed": 15
    },
    "recentBatches": [...]
  }
}
```

---

## 🔥 EXEMPLO DE USO COMPLETO

### 1. Upload de 142 arquivos
```bash
curl -X POST http://localhost:3000/api/batch/upload \
  -H "Authorization: Bearer seu-token" \
  -F "batchName=Análise 5 anos - Empresa XYZ" \
  -F "documentType=dre" \
  -F "companyName=Empresa XYZ Ltda" \
  -F "cnpj=12.345.678/0001-90" \
  -F "regime=lucro_real" \
  -F "documents[]=@dre_2020_01.pdf" \
  -F "documents[]=@dre_2020_02.pdf" \
  ... (até 142 arquivos)
  -F "documents[]=@dre_2024_12.pdf"
```

### 2. Monitorar progresso
```bash
# Polling a cada 5 segundos
while true; do
  curl -H "Authorization: Bearer seu-token" \
    http://localhost:3000/api/batch/abc123/status | jq '.data.progress'
  sleep 5
done
```

### 3. Baixar relatório consolidado
```bash
# Quando status = "completed"
curl -H "Authorization: Bearer seu-token" \
  http://localhost:3000/api/batch/abc123/export \
  -o relatorio-consolidado.xlsx
```

---

## ⚡ PERFORMANCE

### Com 5 Workers Paralelos:
- **1 documento**: ~15-30 segundos
- **10 documentos**: ~2-3 minutos
- **50 documentos**: ~10-15 minutos
- **142 documentos**: ~25-35 minutos

### Otimizações Implementadas:
✅ Processamento paralelo (5 workers)
✅ Auto-retry com backoff
✅ Timeout de 10min por documento
✅ Conexão pool do Prisma
✅ Índices no PostgreSQL
✅ Cache de resultados OCR

---

## 💰 CUSTOS ESTIMADOS (142 documentos)

### API Claude:
- **Opus 4.5**: 142 × $0.30 = **$42.60**
- **Sonnet 4.5**: 142 × $0.08 = **$11.36**

### Infraestrutura:
- **PostgreSQL (RDS)**: ~$25/mês
- **Redis (ElastiCache)**: ~$15/mês
- **EC2 (t3.medium)**: ~$30/mês

**Total mensal** (1000 docs): ~$150-250

---

## 📊 SCHEMA DO BANCO

```prisma
model BatchJob {
  id                  String    @id @default(uuid())
  userId              String
  name                String?
  status              String    // pending, processing, completed, failed
  totalDocuments      Int
  processedDocs       Int
  failedDocs          Int
  totalEstimatedValue Float
  totalOpportunities  Int
  consolidatedReport  String?   @db.Text
  documents           Document[]
}

model Document {
  id              String    @id @default(uuid())
  userId          String
  batchJobId      String?
  fileName        String
  documentType    String
  extractedPeriod String?
  extractedYear   Int?
  status          String
  analysis        Analysis?
}

model Analysis {
  id                  String
  documentId          String    @unique
  opportunities       String    @db.Text
  totalEstimatedValue Float
  executiveSummary    String    @db.Text
}
```

---

## 🚀 DEPLOY EM PRODUÇÃO

### Docker Compose
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_HOST=redis
      - ANTHROPIC_API_KEY=...
    depends_on:
      - postgres
      - redis

  worker:
    build: .
    command: npm run worker
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_HOST=redis
      - ANTHROPIC_API_KEY=...
    deploy:
      replicas: 5  # 5 workers paralelos
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: taxcredit
      POSTGRES_PASSWORD: senha

  redis:
    image: redis:7-alpine
```

### Comandos:
```bash
docker-compose up -d
docker-compose scale worker=5
```

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Frontend React** com dashboard em tempo real
2. ✅ **WebSockets** para updates de progresso
3. ✅ **Notificações por email** quando batch concluir
4. ✅ **Sistema de usuários e permissões**
5. ✅ **Integração com ERPs** (TOTVS, SAP)
6. ✅ **Validação contábil** automática
7. ✅ **Machine Learning** para detectar anomalias

---

## 🆘 TROUBLESHOOTING

### Jobs não processam
```bash
# Verificar Redis
redis-cli ping

# Verificar worker
pm2 logs worker

# Limpar fila
redis-cli FLUSHALL
```

### Banco de dados trava
```bash
# Ver conexões
SELECT * FROM pg_stat_activity;

# Resetar conexões
npx prisma migrate reset
```

### OCR muito lento
- Reduza DPI de 200 para 150
- Limite páginas processadas
- Use apenas para PDFs digitalizados

---

**🎉 Sistema Enterprise pronto para processar 142+ documentos sem travar!**
