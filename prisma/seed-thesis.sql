-- ============================================================
-- SEED: Migrar 34 teses hardcoded + TESE-035 Equiparacao Hospitalar
-- Rodar no SQL Editor do Supabase
-- ============================================================

-- Primeiro, executar a migration (se ainda nao rodou):
-- Cole aqui o conteudo de prisma/migrations/20260219_tax_thesis/migration.sql

-- ============================================================
-- BLOCO 1: PIS/COFINS
-- ============================================================

INSERT INTO "TaxThesis" ("id","code","name","description","tributo","fundamentacao","tribunal","tema","status","risco","probabilidade","setoresAplicaveis","regimesAplicaveis","formulaCalculo","ativo","createdAt","updatedAt") VALUES
(gen_random_uuid(),'TESE-001','Exclusão do ICMS da base do PIS — Tese do Século','Exclusão do ICMS destacado nas vendas da base de cálculo do PIS no regime não-cumulativo.','PIS','RE 574.706 — Tema 69 STF — Repercussão Geral. Modulação: efeitos a partir de 15/03/2017 (exceto quem ajuizou antes).','STF','Tema 69','active','baixo',95,'["todos"]','["lucro_real"]','ICMS destacado nas vendas × alíquota PIS 1,65%',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-002','Exclusão do ICMS da base da COFINS — Tese do Século','Exclusão do ICMS destacado nas vendas da base de cálculo da COFINS no regime não-cumulativo.','COFINS','RE 574.706 — Tema 69 STF — Repercussão Geral. Modulação: efeitos a partir de 15/03/2017.','STF','Tema 69','active','baixo',95,'["todos"]','["lucro_real"]','ICMS destacado nas vendas × alíquota COFINS 7,6%',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-003','Créditos de PIS sobre insumos — conceito ampliado','Crédito de PIS sobre insumos com conceito ampliado pelo STJ. Itens elegíveis: energia elétrica, manutenção, EPIs, fretes, embalagens, combustíveis, materiais intermediários.','PIS','REsp 1.221.170/PR — Tema 779 STJ | Lei 10.637/2002 art. 3° | IN RFB 1.911/2019 art. 172','STJ','Tema 779','active','medio',75,'["industria","comercio","todos"]','["lucro_real"]','Custos elegíveis × 1,65%',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-004','Créditos de COFINS sobre insumos — conceito ampliado','Crédito de COFINS sobre insumos com conceito ampliado pelo STJ.','COFINS','REsp 1.221.170/PR — Tema 779 STJ | Lei 10.833/2003 art. 3°','STJ','Tema 779','active','medio',75,'["industria","comercio","todos"]','["lucro_real"]','Custos elegíveis × 7,6%',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-005','PIS/COFINS Monofásico — Medicamentos e Farmacêuticos','Medicamentos e farmacêuticos com PIS/COFINS concentrado na indústria (monofásico). Hospitais e clínicas que revendem pagam a maior por erro de NCM.','PIS/COFINS','Lei 10.147/2000 | Lei 10.865/2004, Art. 25 | IN RFB 1.911/2019, Art. 150-158','STJ',NULL,'active','medio',80,'["saude"]','["lucro_real","lucro_presumido"]','Total de compras monofásicas × 9,25% × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-006','PIS/COFINS sobre Ativo Imobilizado — bens de capital','Crédito de PIS/COFINS sobre depreciação de bens do ativo imobilizado adquiridos a partir de 01/05/2004.','PIS/COFINS','Lei 10.637/2002, Art. 3°, VI (PIS) | Lei 10.833/2003, Art. 3°, VI (COFINS) | IN RFB 1.911/2019, Art. 172','STJ',NULL,'active','medio',75,'["saude","industria","mineracao","transporte"]','["lucro_real"]','Valor dos bens × 9,25% ÷ 48 × meses restantes × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-007','PIS/COFINS de Exportação — Ressarcimento em espécie','Exportações com alíquota zero mantêm créditos integrais das entradas. Excesso pode ser ressarcido via PER/DCOMP Web.','PIS/COFINS','Lei 10.637/2002, Art. 5° (PIS) | Lei 10.833/2003, Art. 6° (COFINS) | CF Art. 149, §2°, I','STF',NULL,'active','baixo',85,'["exportacao","industria","agro"]','["lucro_real"]','Total de créditos PIS/COFINS × % exportação / receita total × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-008','Exclusão do ISS da base do PIS/COFINS','ISS é tributo, não receita — mesma lógica do Tema 69.','PIS/COFINS','RE 592.616 — Tema 1.093 STF (em julgamento, tendência favorável)','STF','Tema 1.093','active','medio',65,'["servicos","saude","tecnologia"]','["lucro_real"]','ISS destacado × (PIS 1,65% + COFINS 7,6%)',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-009','PIS/COFINS sobre receitas financeiras — Alíquota reduzida','Receitas financeiras no Lucro Real tributadas por alíquotas reduzidas (PIS 0,65%, COFINS 4%). Erro comum: aplicar alíquotas cheias.','PIS/COFINS','Decreto 8.426/2015 | Lei 10.865/2004, Art. 27, §2° | ADI 5277 STF','STF',NULL,'active','baixo',80,'["todos"]','["lucro_real"]','Receitas financeiras × diferença entre alíquota cheia e reduzida × 5 anos',true,NOW(),NOW()),

-- ============================================================
-- BLOCO 2: ICMS
-- ============================================================

(gen_random_uuid(),'TESE-010','ICMS sobre energia elétrica — Exclusão de TUSD/TUST','TUSD/TUST representam 40-60% da conta de energia e não devem compor base do ICMS.','ICMS','RE 714.139 — Tema 986 STF | LC 87/1996 art. 13','STF','Tema 986','active','baixo',85,'["industria","comercio","todos"]','["lucro_real","lucro_presumido"]','Valor energia × 45% (TUSD/TUST) × alíquota ICMS estadual',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-011','ICMS-ST Ressarcimento — base presumida > efetiva','Quando MVA presumida é maior que margem efetiva, há direito a ressarcimento.','ICMS','RE 593.849 — Tema 201 STF | Art. 150, §7° CF/88','STF','Tema 201','active','medio',60,'["comercio","varejo"]','["lucro_real","lucro_presumido"]','5-8% do ICMS-ST recolhido',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-012','ICMS sobre ativo permanente — CIAP','Crédito de 1/48 avos por mês sobre ICMS de máquinas e equipamentos.','ICMS','LC 87/96 art. 20 | LC 102/2000','STJ',NULL,'active','medio',70,'["industria","todos"]','["lucro_real","lucro_presumido"]','ICMS de bens imobilizados × 1/48 por mês',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-013','ICMS Acumulado de Exportação','Exportadores mantêm crédito de ICMS nas entradas mas não têm débito. Crédito acumulado pode ser transferido, utilizado ou ressarcido.','ICMS','CF Art. 155, §2°, X, "a" | LC 87/1996 (Lei Kandir), Art. 3°, II e Art. 25, §1°','STF',NULL,'active','baixo',90,'["exportacao","industria","agro","mineracao"]','["lucro_real","lucro_presumido"]','Total ICMS entradas × % exportação × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-014','ICMS e PIS/COFINS sobre Frete','Frete sobre compras gera crédito de ICMS e PIS/COFINS. Especialmente relevante para indústrias pesadas.','ICMS/PIS/COFINS','LC 87/96, Art. 20 | Lei 10.637/2002 Art. 3°, IX | Lei 10.833/2003 Art. 3°, IX','STJ','Tema 779','active','medio',75,'["industria","mineracao","comercio"]','["lucro_real"]','Gastos com frete × alíquotas respectivas × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-015','Exclusão do ICMS-ST da base de PIS/COFINS','Empresas substituídas podem excluir ICMS-ST da base de PIS/COFINS — mesma lógica do Tema 69.','PIS/COFINS','REsp 1.896.678/RS — Tema 1.048 STJ','STJ','Tema 1.048','active','baixo',80,'["comercio","varejo","farmacia"]','["lucro_real"]','ICMS-ST embutido × (PIS 1,65% + COFINS 7,6%) × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-016','ICMS não incide na transferência entre filiais — ADC 49','STF decidiu que não incide ICMS na transferência entre estabelecimentos do mesmo titular.','ICMS','ADC 49 STF (2021, modulação 2024) | LC 204/2023','STF','ADC 49','active','baixo',85,'["comercio","industria","varejo"]','["lucro_real","lucro_presumido"]','ICMS recolhido em transferências entre filiais × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-017','DIFAL — Diferencial de Alíquota','DIFAL cobrado antes da LC 190/2022 é inconstitucional. Base de cálculo incorreta também gera direito a restituição.','ICMS','EC 87/2015 | LC 190/2022 | ADI 5469 e RE 1.287.019 STF','STF',NULL,'active','medio',70,'["ecommerce","varejo","comercio"]','["lucro_real","lucro_presumido"]','DIFAL pago × período de irregularidade × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-018','Crédito extemporâneo de ICMS','Crédito não escriturado no período correto pode ser aproveitado dentro do prazo de 5 anos.','ICMS','LC 87/96, Art. 23 | RICMS de cada estado','STJ',NULL,'active','medio',75,'["todos"]','["lucro_real","lucro_presumido"]','ICMS de notas não escrituradas × 5 anos',true,NOW(),NOW()),

-- ============================================================
-- BLOCO 3: CONTRIBUIÇÕES PREVIDENCIÁRIAS
-- ============================================================

(gen_random_uuid(),'TESE-019','INSS Patronal sobre verbas indenizatórias','Exclusão de verbas indenizatórias da base do INSS patronal (20%): terço de férias, aviso prévio indenizado, auxílio-doença 15 dias, salário-maternidade.','INSS','RE 1.072.485 — Tema 985 STF | REsp 1.230.957 — Tema 478 STJ | Art. 22, I da Lei 8.212/91','STF/STJ','Tema 985 / Tema 478','active','baixo',90,'["todos"]','["lucro_real","lucro_presumido","simples"]','Verbas indenizatórias × 25,8% (INSS 20% + RAT + Terceiros) × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-020','Contribuições a Terceiros (Sistema S) — Limitação da base','Base de contribuições a terceiros deve ser limitada a 20 salários mínimos.','INSS','Art. 4°, parágrafo único da Lei 6.950/81','STJ',NULL,'active','alto',55,'["todos"]','["lucro_real","lucro_presumido"]','(Folha - 20 SM) × alíquotas Sistema S (5,8%)',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-021','RAT/FAP — Revisão do enquadramento','FAP pode reduzir RAT em até 50%.','INSS','Art. 22, II da Lei 8.212/91 | Decreto 3.048/99','CARF',NULL,'active','medio',65,'["industria","todos"]','["lucro_real","lucro_presumido"]','RAT atual × 50% de redução potencial',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-022','FGTS sobre verbas indenizatórias','Verbas indenizatórias não integram base do FGTS (8%). Mesma lógica do INSS.','FGTS','Lei 8.036/90, Art. 15 | Temas 985 e 478','STJ',NULL,'active','medio',75,'["todos"]','["lucro_real","lucro_presumido"]','Verbas indenizatórias × 8% FGTS × 5 anos',true,NOW(),NOW()),

-- ============================================================
-- BLOCO 4: IRPJ/CSLL
-- ============================================================

(gen_random_uuid(),'TESE-023','Exclusão de benefícios fiscais de ICMS da base do IRPJ/CSLL','Subvenções de ICMS (benefícios fiscais estaduais) excluídas da base de IRPJ/CSLL.','IRPJ/CSLL','LC 160/2017 | Art. 30 da Lei 12.973/2014 | EREsp 1.517.492/PR','STJ',NULL,'active','medio',70,'["industria","comercio"]','["lucro_real"]','Valor do benefício × 34% (IRPJ 25% + CSLL 9%)',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-024','PAT — Programa de Alimentação do Trabalhador','Dedução direta do IRPJ, limitada a 4% do IRPJ devido.','IRPJ','Lei 6.321/76 | IN RFB 2.101/2022',NULL,NULL,'active','baixo',80,'["todos"]','["lucro_real"]','4% do IRPJ devido',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-025','Lei do Bem — Incentivos à inovação tecnológica','Exclusão de 60-80% dos gastos com P&D da base do IRPJ/CSLL.','IRPJ/CSLL','Lei 11.196/2005 | Decreto 5.798/2006',NULL,NULL,'active','medio',75,'["industria","tecnologia"]','["lucro_real"]','Gastos com P&D × 60-80% × 34%',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-026','IRPJ/CSLL — Equiparação Hospitalar (Lucro Presumido)','Clínicas e centros médicos que prestam serviços hospitalares podem usar base reduzida de IRPJ (8%) e CSLL (12%) em vez de 32%.','IRPJ/CSLL','Lei 9.249/95, Art. 15, §1°, III, "a" | IN RFB 1.234/2012 | REsp 1.116.399/BA (STJ)','STJ',NULL,'active','baixo',85,'["saude"]','["lucro_presumido"]','Receita × (32% - 8%) × 15% IRPJ + CSLL (32% - 12%) × 9%',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-027','IRPJ/CSLL sobre SELIC em repetição de indébito — Tema 1.079','IRPJ/CSLL não incidem sobre taxa SELIC recebida em restituição tributária (natureza de dano emergente).','IRPJ/CSLL','RE 1.063.187 — Tema 1.079 STF','STF','Tema 1.079','active','baixo',95,'["todos"]','["lucro_real"]','Valor SELIC recebida × 34% (IRPJ 25% + CSLL 9%)',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-028','JCP — Juros sobre Capital Próprio retroativo','Empresa no Lucro Real pode deduzir JCP da base de IRPJ/CSLL, limitado à TJLP × PL.','IRPJ/CSLL','Lei 9.249/95, Art. 9° | IN RFB 1.700/2017 | Parecer COSIT 12/2012',NULL,NULL,'active','medio',85,'["todos"]','["lucro_real"]','PL × TJLP × 34% (limitado a 50% do lucro líquido)',true,NOW(),NOW()),

-- ============================================================
-- BLOCO 5: IPI
-- ============================================================

(gen_random_uuid(),'TESE-029','Créditos de IPI sobre insumos não aproveitados','Saldo credor de IPI acumulado pode ser ressarcido.','IPI','Art. 225-227 do RIPI (Decreto 7.212/2010)',NULL,NULL,'active','medio',65,'["industria"]','["lucro_real","lucro_presumido"]','Saldo credor IPI acumulado',true,NOW(),NOW()),

-- ============================================================
-- BLOCO 6: ISS
-- ============================================================

(gen_random_uuid(),'TESE-030','ISS — Revisão de alíquota e base de cálculo','Revisão de alíquota aplicada e base de cálculo do ISS. Inclui segregação de procedimentos, incentivos municipais e base incorreta.','ISS','LC 116/2003 | Lei Municipal | CF Art. 156, III',NULL,NULL,'active','medio',60,'["saude","servicos","tecnologia"]','["lucro_real","lucro_presumido","simples"]','Receita de serviços × diferença de alíquota × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-031','ISS — Dedução de materiais da base de cálculo','Serviços com fornecimento de materiais podem ter dedução na base do ISS.','ISS','LC 116/2003, Art. 7°, §2° | Jurisprudência STJ','STJ',NULL,'active','alto',55,'["construcao","saude"]','["lucro_real","lucro_presumido"]','Materiais fornecidos × alíquota ISS × 5 anos',true,NOW(),NOW()),

-- ============================================================
-- BLOCO 7: IMPORTAÇÃO
-- ============================================================

(gen_random_uuid(),'TESE-032','Créditos de PIS/COFINS-Importação','Empresas no Lucro Real com importações têm direito a crédito de PIS (2,1%) e COFINS (9,65%) pagos na importação.','PIS/COFINS','Lei 10.865/2004, Art. 15 | IN RFB 1.911/2019',NULL,NULL,'active','medio',75,'["saude","industria","tecnologia"]','["lucro_real"]','PIS/COFINS-Importação pagos × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-033','ICMS-Importação — Crédito na aquisição','ICMS pago na importação de ativo imobilizado gera crédito (1/48 avos). Insumos geram crédito integral.','ICMS','LC 87/96, Art. 20 | CF Art. 155, §2°, IX, "a"',NULL,NULL,'active','medio',70,'["industria","saude"]','["lucro_real","lucro_presumido"]','ICMS-Importação × 1/48 (ativo) ou integral (insumos)',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-034','IPI-Importação — Crédito na industrialização','IPI pago na importação de insumos industriais gera crédito. Saldo credor vinculado a exportação pode ser ressarcido.','IPI','RIPI (Decreto 7.212/2010), Art. 225 | CF Art. 153, §3°, II',NULL,NULL,'active','medio',65,'["industria"]','["lucro_real","lucro_presumido"]','IPI-Importação sobre insumos industriais',true,NOW(),NOW()),

-- ============================================================
-- BLOCO 8: AGROINDÚSTRIA
-- ============================================================

(gen_random_uuid(),'TESE-036','Crédito presumido de PIS/COFINS na agroindústria','Agroindústrias que compram de PF/cooperativas têm crédito presumido (PIS 0,99%, COFINS 4,56%).','PIS/COFINS','Lei 10.925/2004, Art. 8° | IN RFB 1.911/2019, Arts. 518-530',NULL,NULL,'active','baixo',90,'["agro"]','["lucro_real"]','Compras de PF/cooperativas × alíquotas presumidas × 5 anos',true,NOW(),NOW()),

(gen_random_uuid(),'TESE-037','FUNRURAL — Contribuição do produtor rural','FUNRURAL indevido de 1991-2001 pode ser restituído. Pós-2001 há teses acessórias (exportação, sub-rogação).','INSS','RE 718.874 — Tema 669 STF | Art. 25 da Lei 8.212/91','STF','Tema 669','active','medio',70,'["agro"]','["lucro_real","lucro_presumido"]','FUNRURAL pago × período',true,NOW(),NOW());

-- ============================================================
-- TESE-035: Equiparação Hospitalar (solicitada pelo Felicio)
-- ============================================================

INSERT INTO "TaxThesis" ("id","code","name","description","tributo","fundamentacao","tribunal","tema","status","risco","probabilidade","setoresAplicaveis","regimesAplicaveis","formulaCalculo","ativo","createdAt","updatedAt") VALUES
(gen_random_uuid(),'TESE-035','Equiparação Hospitalar — Redução de IRPJ/CSLL para Clínicas','Clínicas médicas que prestam serviços de natureza hospitalar (além de consultas simples) podem utilizar base de cálculo reduzida de IRPJ (8%) e CSLL (12%) em vez dos 32% padrão, mesmo sem internação ou estrutura de hospital. Serviços elegíveis: cirurgias, exames, diagnósticos, procedimentos ambulatoriais, fisioterapia, radiologia, etc. Requisitos: sociedade empresária, serviços de natureza hospitalar, conformidade sanitária.','IRPJ/CSLL','Tema 217 STJ (REsp 1.116.399/BA) | Lei 9.249/95, Art. 15, §1°, III, ''a'' | Parecer SEI nº 7.689/2021/ME (PGFN)','STJ','Tema 217','active','baixo',90,'["saude"]','["lucro_presumido"]','Base reduzida de 32% para 8% (IRPJ) e 12% (CSLL). Economia de até 70% em IRPJ/CSLL. Recuperação retroativa de 5 anos.',true,NOW(),NOW());
