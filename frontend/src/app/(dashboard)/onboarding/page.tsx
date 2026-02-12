'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const steps = [
  { id: 1, title: 'Dados da Empresa', description: 'Informações básicas' },
  { id: 2, title: 'Responsável Legal', description: 'Identificação do representante' },
  { id: 3, title: 'Documentos', description: 'Upload de documentos obrigatórios' },
  { id: 4, title: 'Confirmação', description: 'Revisar e confirmar' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState({ name: '', cnpj: '', address: '', regime: '', sector: '' });
  const [legal, setLegal] = useState({ name: '', cpf: '', rg: '', email: '', phone: '' });
  const [docs, setDocs] = useState<{ contratoSocial?: File; identidade?: File; comprovante?: File }>({});

  const handleFinish = async () => {
    setLoading(true);
    // Simular envio
    setTimeout(() => {
      setLoading(false);
      router.push('/dashboard');
    }, 2000);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Onboarding - Complete seu Cadastro</h1>
        <p className="text-gray-500 text-sm mt-1">Preencha os dados para iniciar a operação</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center mb-8">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              currentStep >= step.id ? 'bg-brand-700 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {currentStep > step.id ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
              ) : step.id}
            </div>
            <div className="ml-3 hidden sm:block">
              <p className={`text-sm font-medium ${currentStep >= step.id ? 'text-gray-900' : 'text-gray-400'}`}>{step.title}</p>
            </div>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-4 ${currentStep > step.id ? 'bg-brand-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="card p-8">
        {/* Step 1: Dados da empresa */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">Dados da Empresa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social *</label>
                <input value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ *</label>
                <input value={company.cnpj} onChange={e => setCompany(p => ({ ...p, cnpj: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Regime Tributário *</label>
                <select value={company.regime} onChange={e => setCompany(p => ({ ...p, regime: e.target.value }))} className="input">
                  <option value="">Selecione</option>
                  <option value="lucro_real">Lucro Real</option>
                  <option value="lucro_presumido">Lucro Presumido</option>
                  <option value="simples">Simples Nacional</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Setor de Atuação</label>
                <input value={company.sector} onChange={e => setCompany(p => ({ ...p, sector: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input value={company.address} onChange={e => setCompany(p => ({ ...p, address: e.target.value }))} className="input" />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Responsável legal */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">Responsável Legal</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input value={legal.name} onChange={e => setLegal(p => ({ ...p, name: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
                <input value={legal.cpf} onChange={e => setLegal(p => ({ ...p, cpf: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                <input value={legal.rg} onChange={e => setLegal(p => ({ ...p, rg: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={legal.email} onChange={e => setLegal(p => ({ ...p, email: e.target.value }))} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone *</label>
                <input value={legal.phone} onChange={e => setLegal(p => ({ ...p, phone: e.target.value }))} className="input" required />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Documentos */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">Documentos Obrigatórios</h3>
            <p className="text-sm text-gray-500">Envie os documentos para validação jurídica</p>

            {[
              { key: 'contratoSocial', label: 'Contrato Social / Estatuto', desc: 'Última alteração consolidada' },
              { key: 'identidade', label: 'Documento de Identidade', desc: 'RG ou CNH do responsável legal' },
              { key: 'comprovante', label: 'Comprovante de Endereço', desc: 'Conta de luz, água ou telefone recente' },
            ].map(doc => (
              <div key={doc.key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{doc.label}</p>
                    <p className="text-xs text-gray-500">{doc.desc}</p>
                  </div>
                  {(docs as any)[doc.key] ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-green-600 font-medium">{(docs as any)[doc.key].name}</span>
                      <button onClick={() => setDocs(p => ({ ...p, [doc.key]: undefined }))} className="text-red-400 hover:text-red-600">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                      Selecionar
                      <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={e => {
                        if (e.target.files?.[0]) setDocs(p => ({ ...p, [doc.key]: e.target.files![0] }));
                      }} />
                    </label>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Confirmacao */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <h3 className="text-lg font-semibold text-gray-900">Revisão e Confirmação</h3>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 uppercase">Empresa</h4>
              <p className="text-sm text-gray-600">{company.name || '-'} | CNPJ: {company.cnpj || '-'} | {company.regime || '-'}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 uppercase">Responsável Legal</h4>
              <p className="text-sm text-gray-600">{legal.name || '-'} | CPF: {legal.cpf || '-'} | {legal.email || '-'}</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700 uppercase">Documentos</h4>
              <p className="text-sm text-gray-600">
                Contrato Social: {docs.contratoSocial ? 'Enviado' : 'Pendente'} |
                Identidade: {docs.identidade ? 'Enviado' : 'Pendente'} |
                Comprovante: {docs.comprovante ? 'Enviado' : 'Pendente'}
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>Ao confirmar</strong>, você autoriza a TaxCredit e o escritório parceiro a analisarem os documentos da sua empresa para identificar oportunidades de recuperação de créditos tributários.
              </p>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <button
            onClick={() => setCurrentStep(p => Math.max(1, p - 1))}
            disabled={currentStep === 1}
            className="btn-secondary disabled:opacity-30"
          >
            Voltar
          </button>

          {currentStep < 4 ? (
            <button onClick={() => setCurrentStep(p => p + 1)} className="btn-primary">
              Próximo
            </button>
          ) : (
            <button onClick={handleFinish} disabled={loading} className="btn-primary flex items-center gap-2">
              {loading ? 'Finalizando...' : 'Confirmar e Iniciar'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
