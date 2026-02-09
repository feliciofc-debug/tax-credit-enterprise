# 🔧 GUIA DE INTEGRAÇÃO - AUTOMAÇÃO DE CRÉDITOS TRIBUTÁRIOS

## 📦 NOVOS ARQUIVOS ADICIONADOS

Os seguintes arquivos foram adicionados ao projeto Enterprise:

```
enterprise/
├── src/
│   ├── services/
│   │   ├── batchConsolidator.service.ts        (já existia)
│   │   ├── ocr.service.ts                       (já existia)
│   │   ├── periodExtractor.service.ts           (já existia)
│   │   └── tax-credit-documentation.service.ts  ✨ NOVO!
│   │
│   └── routes/
│       ├── batch.routes.ts                      (já existia)
│       ├── dashboard.routes.ts                  (já existia)
│       └── tax-credit.routes.ts                 ✨ NOVO!
```

---

## 🔗 INTEGRAÇÃO NO SERVIDOR PRINCIPAL

### 1. Atualizar `src/index.ts`

Adicione a nova rota de créditos tributários:

```typescript
// src/index.ts

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';

// Rotas existentes
import analysisRoutes from './routes/analysis.routes';
import healthRoutes from './routes/health.routes';
import batchRoutes from './routes/batch.routes';
import dashboardRoutes from './routes/dashboard.routes';

// ✨ NOVA ROTA - Automação de créditos
import taxCreditRoutes from './routes/tax-credit.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: 'Muitas requisições deste IP, tente novamente mais tarde.'
});

app.use('/api/', limiter);

// Rotas
app.use('/api/health', healthRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ✨ NOVA ROTA
app.use('/api/tax-credit', taxCreditRoutes);

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Servidor rodando na porta ${PORT}`);
  logger.info(`📊 Ambiente: ${process.env.NODE_ENV}`);
  logger.info(`✨ Automação de créditos tributários: ATIVA`);
});

export default app;
```

---

## 🎯 NOVOS ENDPOINTS DISPONÍVEIS

### 1. Gerar Documentação Completa

```bash
POST /api/tax-credit/generate-docs
Authorization: Bearer <token>
Content-Type: application/json

{
  "analysisId": "uuid-da-analise",
  "opportunityIndex": 0
}

# Retorna ZIP com:
# - Memória de Cálculo (PDF)
# - Planilha de Apuração (Excel)
# - Parecer Técnico (PDF)
# - Petição Modelo (PDF)
# - Checklist de Validação (JSON)
```

### 2. Validar Checklist de Formalização

```bash
POST /api/tax-credit/validate-checklist
Authorization: Bearer <token>
Content-Type: application/json

{
  "analysisId": "uuid",
  "opportunityIndex": 0,
  "checklistUpdates": [
    {
      "item": "Notas fiscais separadas",
      "status": "ok",
      "optional": false
    },
    {
      "item": "SPED transmitido",
      "status": "ok",
      "optional": false
    }
  ]
}

# Retorna se está pronto para protocolar
```

### 3. Preparar dados para PER/DCOMP

```bash
POST /api/tax-credit/prepare-perdcomp
Authorization: Bearer <token>
Content-Type: application/json

{
  "analysisId": "uuid",
  "opportunityIndex": 0
}

# Retorna dados formatados para copiar/colar no e-CAC
```

### 4. Obter Guia de Protocolo

```bash
GET /api/tax-credit/filing-guide/:creditType
Authorization: Bearer <token>

# Exemplo:
GET /api/tax-credit/filing-guide/PIS_COFINS
GET /api/tax-credit/filing-guide/ICMS

# Retorna passo-a-passo de como protocolar
```

---

## 🖥️ INTEGRAÇÃO NO FRONTEND

### Exemplo de uso em React:

```typescript
// components/OpportunityCard.tsx

import React from 'react';

interface Opportunity {
  tipo: string;
  descricao: string;
  valorEstimado: number;
  probabilidadeRecuperacao: number;
  fundamentacaoLegal: string;
}

interface Props {
  analysisId: string;
  opportunityIndex: number;
  opportunity: Opportunity;
}

export const OpportunityCard: React.FC<Props> = ({ 
  analysisId, 
  opportunityIndex, 
  opportunity 
}) => {
  
  const handleGenerateDocs = async () => {
    try {
      const response = await fetch('/api/tax-credit/generate-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          analysisId,
          opportunityIndex
        })
      });

      if (!response.ok) throw new Error('Erro ao gerar documentação');

      // Download do ZIP
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documentacao-${opportunity.tipo}.zip`;
      a.click();

      alert('✅ Documentação gerada com sucesso!');
      
      // Redirecionar para menu de formalização
      window.location.href = '/formalizacao';

    } catch (error) {
      console.error(error);
      alert('❌ Erro ao gerar documentação');
    }
  };

  return (
    <div className="opportunity-card">
      <h3>{opportunity.tipo}</h3>
      <p className="value">
        R$ {opportunity.valorEstimado.toLocaleString('pt-BR')}
      </p>
      <p className="probability">
        Probabilidade: {opportunity.probabilidadeRecuperacao}%
      </p>
      <p className="legal-basis">
        {opportunity.fundamentacaoLegal}
      </p>
      
      <button 
        onClick={handleGenerateDocs}
        className="btn-primary"
      >
        📥 Gerar Documentação Completa
      </button>
    </div>
  );
};
```

### Menu de Formalização:

```typescript
// pages/Formalizacao.tsx

import React, { useState } from 'react';

export const FormalizacaoPage: React.FC = () => {
  const [protocolNumber, setProtocolNumber] = useState('');

  const handleViewEcacData = async (analysisId: string, oppIndex: number) => {
    const response = await fetch('/api/tax-credit/prepare-perdcomp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ analysisId, opportunityIndex: oppIndex })
    });

    const data = await response.json();
    
    // Mostrar modal com dados preparados
    showModal(data);
  };

  const handleSaveProtocol = async () => {
    // Salvar número do protocolo no banco
    await fetch('/api/tax-credit/save-protocol', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysisId: '...',
        opportunityIndex: 0,
        protocolNumber,
        protocolDate: new Date()
      })
    });

    alert('✅ Protocolo salvo! Acompanhe o status no dashboard.');
  };

  return (
    <div className="formalizacao-page">
      <h1>Menu de Formalização de Processos</h1>

      <div className="process-list">
        {/* Lista de processos com docs gerados */}
        
        <div className="process-card">
          <h3>Crédito PIS/COFINS - R$ 450.000</h3>
          
          <div className="checklist">
            <label>
              <input type="checkbox" /> Notas fiscais separadas
            </label>
            <label>
              <input type="checkbox" /> SPED transmitido
            </label>
            <label>
              <input type="checkbox" /> Certificado digital válido
            </label>
            <label>
              <input type="checkbox" /> Contador validou cálculos
            </label>
          </div>

          <button onClick={() => handleViewEcacData('...', 0)}>
            📋 Ver Dados para e-CAC
          </button>

          <div className="protocol-input">
            <input 
              type="text"
              placeholder="Número do protocolo"
              value={protocolNumber}
              onChange={(e) => setProtocolNumber(e.target.value)}
            />
            <button onClick={handleSaveProtocol}>
              ✅ Salvar Protocolo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

---

## 📊 FLUXO COMPLETO DE DADOS

```
1. Usuário faz upload de 142 documentos
   ↓
2. Sistema processa e identifica oportunidades
   ↓
3. Usuário visualiza lista de oportunidades
   ↓
4. Usuário clica "Gerar Documentação" em uma oportunidade
   ↓
5. Backend chama taxCreditDocService.generateDocumentationPackage()
   ↓
6. Claude gera Parecer Técnico e Petição
   ↓
7. Sistema cria PDFs e Excel
   ↓
8. Retorna ZIP para download
   ↓
9. Usuário vai para "Menu de Formalização"
   ↓
10. Usuário valida checklist
   ↓
11. Usuário clica "Ver Dados para e-CAC"
   ↓
12. Sistema mostra dados preparados para copiar/colar
   ↓
13. Usuário protocola no e-CAC manualmente
   ↓
14. Usuário volta e informa número do protocolo
   ↓
15. Sistema salva e inicia acompanhamento automático
```

---

## 🗄️ SCHEMA DO BANCO DE DADOS

Adicione estas tabelas ao Prisma schema:

```prisma
// prisma/schema.prisma

model TaxCreditProcess {
  id                String   @id @default(uuid())
  analysisId        String
  analysis          Analysis @relation(fields: [analysisId], references: [id])
  
  opportunityIndex  Int
  opportunityType   String
  estimatedValue    Float
  
  // Status do processo
  status            String   @default("docs_generated") 
  // docs_generated, checklist_pending, ready_to_file, filed, under_review, approved, rejected
  
  // Documentação gerada
  docsGeneratedAt   DateTime @default(now())
  docsZipPath       String?
  
  // Protocolo
  protocolNumber    String?
  protocolDate      DateTime?
  filedBy           String?  // Quem protocolou
  
  // Acompanhamento
  expectedResponseDate DateTime?
  actualResponseDate   DateTime?
  responseStatus       String?  // deferido, indeferido, parcial
  recoveredValue       Float?
  
  // Checklist
  checklistCompleted Boolean @default(false)
  checklistData      String? @db.Text // JSON
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([status])
  @@index([protocolDate])
}
```

Execute migration:
```bash
npx prisma migrate dev --name add_tax_credit_process
```

---

## ✅ CHECKLIST DE INTEGRAÇÃO

Siga esta ordem:

- [ ] 1. Extrair o ZIP enterprise atualizado
- [ ] 2. Rodar `npm install` (novas dependências: pdfkit)
- [ ] 3. Adicionar a rota em `src/index.ts`
- [ ] 4. Executar migration do Prisma (adicionar TaxCreditProcess)
- [ ] 5. Testar endpoint `/api/tax-credit/generate-docs`
- [ ] 6. Criar frontend do "Menu de Formalização"
- [ ] 7. Testar fluxo completo end-to-end

---

## 🧪 TESTE RÁPIDO

```bash
# 1. Gerar documentação
curl -X POST http://localhost:3000/api/tax-credit/generate-docs \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "analysisId": "uuid-de-uma-analise-real",
    "opportunityIndex": 0
  }' \
  --output documentacao.zip

# 2. Verificar ZIP
unzip -l documentacao.zip

# Deve mostrar:
# - 01-memoria-de-calculo.pdf
# - 02-planilha-apuracao.xlsx
# - 03-parecer-tecnico.pdf
# - 04-peticao-modelo.pdf
# - 05-checklist-validacao.json
```

---

## 💡 DICA PRO - COMANDOS PARA O CURSOR

Cole isto no Cursor depois de extrair o ZIP:

```
Analise os novos arquivos tax-credit-documentation.service.ts e 
tax-credit.routes.ts. Eles implementam automação completa de geração 
de documentação para protocolo de créditos tributários.

Me mostre:
1. Como integrar essas rotas no src/index.ts
2. Como adicionar a tabela TaxCreditProcess no Prisma
3. Como testar os endpoints
4. Sugestões de melhorias no código
```

---

**Pronto! Agora vou gerar o ZIP atualizado! 🚀**
