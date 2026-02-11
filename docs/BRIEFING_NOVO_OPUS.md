# BRIEFING PARA NOVO ASSISTENTE CLAUDE OPUS
# TaxCredit Enterprise — Plataforma de Recuperacao de Creditos Tributarios
# Data: 08/02/2026

---

## CONTEXTO DO PROJETO

A TaxCredit Enterprise e uma plataforma SaaS de recuperacao de creditos tributarios brasileiros. Usa IA (Claude Opus 4.6 e Sonnet 4.5) para analisar documentos fiscais (DRE, Balanco, Balancete, SPED EFD, NFes) e identificar oportunidades de recuperacao de ICMS, PIS, COFINS, IRPJ, CSLL, IPI e tributos trabalhistas.

**Modelo de negocio:**
- Parceiros (advogados/contadores) fazem "quick score" gratuito para prospectar clientes
- Cliente paga taxa de adesao de R$ 2.000 (via PIX C6 Bank)
- Apos pagamento + contrato assinado + documentos enviados pelo cliente → libera analise completa com Opus 4.6
- Sobre valores recuperados: 40% parceiro / 60% plataforma (desvio requer senha master do admin)
- Admin pode vender direto sem parceiro (contrato 2 partes)

**Stack tecnica:**
- Backend: Node.js + TypeScript + Express + Prisma ORM + PostgreSQL (Supabase)
- Frontend: Next.js 14 (App Router) + React + Tailwind CSS
- IA: Anthropic Claude API (Opus 4.6 para analise profunda, Sonnet 4.5 para quick score e documentos)
- Deploy: Vercel (frontend taxcreditenterprise.com) + Render (backend api.taxcreditenterprise.com)
- Email: Resend
- Pagamento: PIX manual via C6 Bank (chave: felicio@atacadistadigital.com, titular: ATOM BRASIL DIGITAL LTDA)

---

## O QUE JA ESTA PRONTO E FUNCIONANDO

### Backend (src/)
- Autenticacao JWT (admin, parceiro, cliente)
- Upload de documentos com Multer (PDF, Excel, TXT/SPED, ZIP ate 50MB)
- ZIP Processor com parser de SPED EFD (extrai registros 0000, C100, C190, E110, E111, E116)
- Claude Service com prompt de 14+ teses tributarias, temperature: 0, sanity validation
- Quick Score assincrono (Sonnet) com polling
- Analise Completa assincrona (Opus 4.6) com polling
- Contratos 3 partes com clausulas de responsabilidade e dados bancarios
- Convites com email (Resend)
- Pagamento PIX: cliente informa → admin confirma com senha master
- Aprovacao manual de novos parceiros

### Frontend (frontend/src/)
- Landing page
- Login unificado (admin/parceiro/cliente)
- Admin: Dashboard, Parceiros, Clientes, Viabilidade, Analises (com PDF/impressao), Convites, Contratos
- Parceiro: Dashboard, Viabilidade, Convites, Contratos
- Cliente: Dashboard (com banner PIX), Upload, Oportunidades, Formalizacao, Perfil

### Banco de Dados (Prisma)
- User, Partner, Contract, ClientInvite, ViabilityAnalysis, Document, BatchJob, Analysis, TaxCreditProcess

---

## O QUE FALTA IMPLEMENTAR (PROXIMO PASSO)

### 1. FORMALIZACAO PROCESSUAL — SEFAZ + PER/DCOMP

Temos um framework legal completo (salvo em docs/FRAMEWORK_LEGAL_SEFAZ_DCOMP.md) com legislacao de 8 estados (SP, RJ, MG, RS, PR, SC, BA, MT) + sistema federal PER/DCOMP.

**Precisamos que voce crie:**

#### A) Material completo do RJ
O framework tem o RJ marcado como "pendente". Preciso da legislacao primaria, sistema eletronico, hipoteses de geracao/transferencia, limites, vedacoes e procedimentos do SEFAZ/RJ, no mesmo formato dos outros 7 estados.

#### B) Modelo de documento oficial para protocolo SEFAZ
Template/modelo do documento que o advogado revisa e assina para dar entrada na SEFAZ estadual. Para pelo menos 1 estado como referencia (SP ou RJ):
- Estrutura do documento (cabecalho, fundamentacao, pedido, anexos)
- Campos que serao preenchidos automaticamente pela plataforma (dados empresa, valores, teses, fundamentacao legal)
- Formato exigido pelo orgao (peticao administrativa? requerimento?)

#### C) Modelo para PER/DCOMP federal
- Quais campos do formulario PER/DCOMP a plataforma pode pre-preencher?
- O documento gerado pela plataforma e um "parecer tecnico" que acompanha o PER/DCOMP, ou e o proprio formulario?
- Formato ideal para o advogado revisar

#### D) Checklist detalhado por estado
Para cada um dos 8 estados, lista concreta e sequencial de:
- Documentos que o cliente deve reunir (NF-es, EFD, demonstrativos, certidoes)
- Formularios especificos do estado (nomes exatos)
- Ordem de submissao
- Prazos de cada etapa

#### E) Modelo de contrato bipartite (2 partes)
Quando o admin vende direto sem parceiro intermediario. Atualmente o contrato sempre gera 3 partes (Plataforma + Parceiro + Cliente). Preciso de um texto de contrato para venda direta com apenas 2 partes (Plataforma + Cliente), mantendo:
- Clausula da taxa de adesao R$ 2.000 (100% plataforma neste caso)
- Clausula de remuneracao sobre creditos recuperados
- Clausulas de responsabilidade e dados bancarios
- Clausula de foro (SP)

#### F) Questao sobre assinatura
Para documentos de protocolo SEFAZ, precisa assinatura digital com certificado ICP-Brasil? Ou assinatura eletronica simples e suficiente para requerimento administrativo?

---

## FLUXO COMPLETO DESEJADO

```
1. Parceiro ou Admin faz Quick Score (gratuito, Sonnet)
2. Se viavel → convida cliente
3. Cliente entra na plataforma
4. Cliente paga taxa R$ 2.000 via PIX
5. Admin confirma pagamento com senha master
6. Contrato e gerado e assinado (3 partes com parceiro, ou 2 partes venda direta)
7. Cliente faz upload dos documentos
8. Analise Completa com Opus 4.6
9. Extrato de creditos tributarios gerado (pode imprimir/PDF)
10. NOVO → Checklist de documentos por estado (orientar cliente)
11. NOVO → Geracao automatica do documento formal para protocolo
12. NOVO → Protocolo SEFAZ estadual ou PER/DCOMP federal
```

Os itens 10, 11 e 12 sao o que falta implementar.

---

## RESUMO DOS ESTADOS E SISTEMAS

| UF | Sistema | Legislacao Principal |
|---|---|---|
| SP | e-CredAc | RICMS/SP Decreto 45.490/2000, Arts. 71-81 |
| RJ | SEFAZ/RJ (PENDENTE) | RICMS/RJ Decreto 27.427/2000 |
| MG | DCA-ICMS | RICMS/MG Decreto 43.080/2002, Anexo VIII |
| RS | e-CAC + Protocolo | RICMS/RS Decreto 37.699/1997, Arts. 58-59 |
| PR | SISCRED | RICMS/PR Decreto 7.871/2017, Arts. 47-61 |
| SC | Reserva + TTD | RICMS/SC Decreto 2.870/2001, Arts. 40-52 |
| BA | E-mail + DT-e | RICMS/BA Decreto 13.780/2012, Art. 317 |
| MT | PAC-e/RUC-e + EFD | RICMS/MT Decreto 2.212/2014, Arts. 99-125 |
| Federal | PER/DCOMP Web + e-CAC | Lei 9.430/1996 Art. 74, IN RFB 2.055/2021 |

---

## FORMATO DE ENTREGA ESPERADO

Pode entregar em texto/markdown formatado que eu vou integrar diretamente no codigo da plataforma. Para templates de documentos, use marcadores {{CAMPO}} para os campos que serao preenchidos automaticamente (ex: {{EMPRESA_NOME}}, {{CNPJ}}, {{VALOR_TOTAL}}, {{TESES_IDENTIFICADAS}}).

Para o checklist, estruture como JSON ou lista hierarquica por estado, para que eu possa transformar em componentes React facilmente.
