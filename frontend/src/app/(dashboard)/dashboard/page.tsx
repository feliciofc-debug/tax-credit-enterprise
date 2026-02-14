'use client';

import { useState, useEffect } from 'react';

interface PendingContract {
  id: string;
  contractNumber: string;
  setupFee: number;
  status: string;
  partnerSigned: boolean;
  clientSigned: boolean;
  partnerName: string;
}

interface PaymentInfo {
  bankName: string;
  pixKey: string;
  pixKeyType: string;
  accountHolder: string;
  setupFee: number;
}

export default function ClientDashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [pendingContract, setPendingContract] = useState<PendingContract | null>(null);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimSent, setClaimSent] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch {}
    }
    fetchPendingContract();
    fetchPaymentInfo();
  }, []);

  const fetchPendingContract = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/contract/my-pending', {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPendingContract(data.data);
        if (data.data.status === 'payment_claimed') {
          setClaimSent(true);
        }
      }
    } catch {}
  };

  const fetchPaymentInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/contract/payment-info', {
        headers: { Authorization: `Bearer ${token || ''}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setPaymentInfo(data.data);
      }
    } catch {}
  };

  const handleClaimPayment = async () => {
    if (!pendingContract) return;
    setClaimLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/contract/${pendingContract.id}/claim-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token || ''}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        setClaimSent(true);
      }
    } catch {}
    finally {
      setClaimLoading(false);
    }
  };

  const handleCopyPix = () => {
    if (paymentInfo?.pixKey) {
      navigator.clipboard.writeText(paymentInfo.pixKey).then(() => {
        setPixCopied(true);
        setTimeout(() => setPixCopied(false), 3000);
      });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Selecione pelo menos um arquivo');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      files.forEach(f => formData.append('documents', f));
      formData.append('documentType', 'DRE');

      const res = await fetch('/api/batch/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`${files.length} documento(s) enviado(s) com sucesso! Você será notificado quando a análise estiver pronta.`);
        setFiles([]);
      } else {
        setError(data.error || 'Erro no envio');
      }
    } catch {
      setError('Erro de conexão com o servidor');
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">T</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">TaxCredit Enterprise</h1>
              <p className="text-gray-500 text-xs">Área do Cliente</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 hidden sm:block">{user?.name}</span>
            <a href="/perfil" className="px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors font-medium">Meus Dados</a>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Olá, {user?.name || 'Cliente'}
        </h2>
        <p className="text-gray-500 mb-6">Envie seus documentos fiscais para análise</p>

        {/* ============================================================ */}
        {/* BANNER DE PAGAMENTO PIX — Aparece quando tem contrato pendente */}
        {/* ============================================================ */}
        {pendingContract && (
          <div className="mb-6 bg-white border-2 border-indigo-300 rounded-2xl shadow-lg overflow-hidden">
            {/* Header do banner */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Taxa de Adesão</h3>
                  <p className="text-indigo-200 text-sm">Contrato {pendingContract.contractNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-extrabold">{formatCurrency(pendingContract.setupFee)}</p>
                  <p className="text-indigo-200 text-xs">via PIX</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {claimSent ? (
                /* Pagamento já informado — aguardando confirmação */
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h4 className="text-gray-900 font-bold text-lg mb-1">Pagamento Informado!</h4>
                  <p className="text-gray-500 text-sm">
                    Estamos verificando o recebimento do PIX.
                    Você será notificado assim que for confirmado.
                  </p>
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-blue-700 text-sm">
                      Após a confirmação, você poderá enviar seus documentos e a análise completa será liberada.
                    </p>
                  </div>
                </div>
              ) : (
                /* Dados do PIX para pagamento */
                <>
                  <p className="text-gray-600 text-sm mb-4">
                    Para liberar a análise completa dos seus créditos tributários, realize o pagamento via PIX:
                  </p>

                  {paymentInfo && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-sm">Banco</span>
                          <span className="text-gray-900 font-medium">{paymentInfo.bankName}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-sm">Titular</span>
                          <span className="text-gray-900 font-medium">{paymentInfo.accountHolder}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500 text-sm">Tipo da Chave</span>
                          <span className="text-gray-900 font-medium">{paymentInfo.pixKeyType}</span>
                        </div>

                        {/* Chave PIX com botão copiar */}
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <p className="text-gray-500 text-xs mb-1">Chave PIX</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3">
                              <p className="text-gray-900 font-mono text-sm font-bold break-all">{paymentInfo.pixKey}</p>
                            </div>
                            <button
                              onClick={handleCopyPix}
                              className={`shrink-0 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                                pixCopied
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              }`}
                            >
                              {pixCopied ? 'Copiado!' : 'Copiar'}
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-gray-200 pt-3 mt-3 flex items-center justify-between">
                          <span className="text-gray-500 text-sm">Valor</span>
                          <span className="text-2xl font-extrabold text-indigo-700">{formatCurrency(pendingContract.setupFee)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Instruções */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-yellow-800 text-sm font-semibold mb-1">Instruções:</p>
                    <ol className="text-yellow-700 text-sm space-y-1 list-decimal list-inside">
                      <li>Copie a chave PIX acima</li>
                      <li>Abra o app do seu banco e faça o PIX no valor de {formatCurrency(pendingContract.setupFee)}</li>
                      <li>Após realizar o pagamento, clique no botão abaixo</li>
                      <li>O administrador vai confirmar o recebimento em até 24h</li>
                    </ol>
                  </div>

                  {/* Botão Já Paguei */}
                  <button
                    onClick={handleClaimPayment}
                    disabled={claimLoading}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {claimLoading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Já Realizei o Pagamento
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Upload Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Enviar Documentos</h3>
          <p className="text-gray-500 text-sm mb-6">
            Envie DREs, Balanços, Balancetes ou outros documentos fiscais em PDF.
            Nossa IA vai analisar e identificar oportunidades de recuperação de créditos tributários.
          </p>

          <form onSubmit={handleUpload}>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center mb-4 hover:border-indigo-400 transition-colors">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"/>
              </svg>
              <input
                type="file"
                multiple
                accept=".pdf,.xlsx,.xls,.csv,.txt,.zip"
                onChange={e => setFiles(Array.from(e.target.files || []))}
                className="w-full max-w-xs mx-auto text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer"
              />
              <p className="text-xs text-gray-400 mt-2">PDF, Excel, SPED (.txt) ou ZIP - até 50MB</p>
            </div>

            {files.length > 0 && (
              <div className="mb-4 bg-indigo-50 rounded-lg p-3">
                <p className="text-indigo-800 text-sm font-medium">{files.length} arquivo(s) selecionado(s):</p>
                <ul className="mt-1 space-y-0.5">
                  {files.map((f, i) => (
                    <li key={i} className="text-indigo-700 text-xs">{f.name} ({(f.size / 1024).toFixed(0)} KB)</li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={uploading || files.length === 0}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {uploading ? 'Enviando...' : 'Enviar Documentos'}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Como funciona</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-indigo-700 text-xs font-bold">1</span>
              </div>
              <p className="text-sm text-gray-600">Realize o pagamento da taxa de adesão via PIX</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-indigo-700 text-xs font-bold">2</span>
              </div>
              <p className="text-sm text-gray-600">Envie seus documentos fiscais (DRE, Balancete, Balanço, SPED)</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-indigo-700 text-xs font-bold">3</span>
              </div>
              <p className="text-sm text-gray-600">Nossa IA analisa e identifica créditos tributários recuperáveis</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-indigo-700 text-xs font-bold">4</span>
              </div>
              <p className="text-sm text-gray-600">Você recebe o extrato completo com valores e documentação para protocolo</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
