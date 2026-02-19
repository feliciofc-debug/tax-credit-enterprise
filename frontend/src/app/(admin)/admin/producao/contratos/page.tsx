'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================
// Types
// ============================

interface ContractChecklist {
  contract_generated?: boolean;
  sent_for_client_signature?: boolean;
  client_signed?: boolean;
  taxcredit_signed?: boolean;
  partner_signed?: boolean;
  fee_received?: boolean;
  sent_to_bank?: boolean;
  bank_registered?: boolean;
  escrow_active?: boolean;
  analysis_released?: boolean;
}

interface Contract {
  id: string;
  contractNumber: string;
  contractType: string;
  status: string;
  setupFee: number;
  setupFeePaid: boolean;
  clientSplitPercent: number;
  partnerSplitPercent: number;
  platformSplitPercent: number;
  totalRecovered: number;
  partnerEarnings: number;
  estimatedCredits: number;
  partnerSigned: boolean;
  clientSigned: boolean;
  clientName: string;
  clientCompany: string;
  partnerName: string | null;
  partnerCompany: string | null;
  checklist: ContractChecklist | null;
  createdAt: string;
}

interface ClientOption {
  id: string;
  name: string;
  email: string;
  company: string;
  cnpj: string;
}

interface PartnerOption {
  id: string;
  name: string;
  company: string;
  cnpj: string;
}

// ============================
// Main Page
// ============================

export default function AdminContratosPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [filter, setFilter] = useState<'all' | 'bipartite' | 'tripartite'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Detail view (checklist + Banco Fibra card)
  const [detailContract, setDetailContract] = useState<Contract | null>(null);
  const [checklistState, setChecklistState] = useState<ContractChecklist>({});
  const [checklistSaving, setChecklistSaving] = useState(false);

  // Status dropdown
  const [statusDropdownId, setStatusDropdownId] = useState<string | null>(null);

  // Confirm payment modal
  const [confirmModal, setConfirmModal] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState('');

  // Form state
  const [contractType, setContractType] = useState<'bipartite' | 'tripartite'>('bipartite');
  const [pctCliente, setPctCliente] = useState(80);
  const [pctPlataforma, setPctPlataforma] = useState(20);
  const [pctParceiro, setPctParceiro] = useState(8);
  const [taxaAdesao, setTaxaAdesao] = useState(2000);
  const [valorEstimado, setValorEstimado] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');

  // Client data (fill from selected client or manual)
  const [ieCliente, setIeCliente] = useState('');

  // Lawyer data
  const [lawyerName, setLawyerName] = useState('');
  const [lawyerOab, setLawyerOab] = useState('');

  // Escrow data
  const [escrowAgencia, setEscrowAgencia] = useState('');
  const [escrowConta, setEscrowConta] = useState('');

  // Partner data (tripartite)
  const [parceiroNome, setParceiroNome] = useState('');
  const [parceiroCnpjCpf, setParceiroCnpjCpf] = useState('');
  const [parceiroTipoPessoa, setParceiroTipoPessoa] = useState('juridica');
  const [parceiroOab, setParceiroOab] = useState('');
  const [parceiroEndereco, setParceiroEndereco] = useState('');
  const [parceiroCidade, setParceiroCidade] = useState('');
  const [parceiroUf, setParceiroUf] = useState('');
  const [parceiroBanco, setParceiroBanco] = useState('');
  const [parceiroAgencia, setParceiroAgencia] = useState('');
  const [parceiroConta, setParceiroConta] = useState('');
  const [parceiroTitular, setParceiroTitular] = useState('');
  const [parceiroDocBanco, setParceiroDocBanco] = useState('');

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formAdminPassword, setFormAdminPassword] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const apiBase = typeof window !== 'undefined'
    ? (localStorage.getItem('apiUrl') || process.env.NEXT_PUBLIC_API_URL || '')
    : '';

  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/contract/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setContracts(data.data);
    } catch {} finally {
      setLoading(false);
    }
  }, [apiBase, token]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setClients(data.data || []);
    } catch {}
  }, [apiBase, token]);

  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/admin/partners`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setPartners(data.data || []);
    } catch {}
  }, [apiBase, token]);

  useEffect(() => {
    fetchContracts();
    fetchClients();
    fetchPartners();
  }, [fetchContracts, fetchClients, fetchPartners]);

  // Percentage logic
  useEffect(() => {
    if (contractType === 'bipartite') {
      setPctParceiro(0);
      setPctPlataforma(100 - pctCliente);
    } else {
      setPctPlataforma(100 - pctCliente - pctParceiro);
    }
  }, [contractType, pctCliente, pctParceiro]);

  const switchToType = (type: 'bipartite' | 'tripartite') => {
    setContractType(type);
    if (type === 'bipartite') {
      setPctCliente(80);
      setPctPlataforma(20);
      setPctParceiro(0);
    } else {
      setPctCliente(80);
      setPctPlataforma(12);
      setPctParceiro(8);
    }
  };

  const pctSum = pctCliente + pctPlataforma + pctParceiro;
  const pctValid = pctSum === 100 && pctCliente >= 50 && pctCliente <= 90;

  const resetForm = () => {
    setContractType('bipartite');
    setPctCliente(80);
    setPctPlataforma(20);
    setPctParceiro(8);
    setTaxaAdesao(2000);
    setValorEstimado(0);
    setSelectedClientId('');
    setSelectedPartnerId('');
    setIeCliente('');
    setLawyerName('');
    setLawyerOab('');
    setEscrowAgencia('');
    setEscrowConta('');
    setParceiroNome('');
    setParceiroCnpjCpf('');
    setParceiroTipoPessoa('juridica');
    setParceiroOab('');
    setParceiroEndereco('');
    setParceiroCidade('');
    setParceiroUf('');
    setParceiroBanco('');
    setParceiroAgencia('');
    setParceiroConta('');
    setParceiroTitular('');
    setParceiroDocBanco('');
    setFormError('');
    setFormAdminPassword('');
  };

  const handleCreateContract = async () => {
    if (!selectedClientId) {
      setFormError('Selecione um cliente');
      return;
    }
    if (!pctValid) {
      setFormError('Percentuais invalidos (soma deve ser 100%, cliente entre 50-90%)');
      return;
    }
    if (contractType === 'tripartite' && !selectedPartnerId) {
      setFormError('Selecione um parceiro para contrato tripartite');
      return;
    }

    setFormLoading(true);
    setFormError('');

    try {
      const body: any = {
        clientId: selectedClientId,
        contractType,
        clientSplitPercent: pctCliente,
        platformSplitPercent: pctPlataforma,
        partnerSplitPercent: contractType === 'tripartite' ? pctParceiro : 0,
        setupFee: taxaAdesao,
        estimatedCredits: valorEstimado || undefined,
        ieCliente,
        lawyerName: lawyerName || undefined,
        lawyerOab: lawyerOab || undefined,
        escrowAgencia: escrowAgencia || undefined,
        escrowConta: escrowConta || undefined,
        adminPassword: formAdminPassword || undefined,
      };

      if (contractType === 'tripartite') {
        body.partnerId = selectedPartnerId;
        body.parceiroNome = parceiroNome || undefined;
        body.parceiroCnpjCpf = parceiroCnpjCpf || undefined;
        body.parceiroTipoPessoa = parceiroTipoPessoa;
        body.parceiroOab = parceiroOab || undefined;
        body.parceiroEndereco = parceiroEndereco || undefined;
        body.parceiroCidade = parceiroCidade || undefined;
        body.parceiroUf = parceiroUf || undefined;
        body.parceiroBanco = parceiroBanco || undefined;
        body.parceiroAgencia = parceiroAgencia || undefined;
        body.parceiroConta = parceiroConta || undefined;
        body.parceiroTitular = parceiroTitular || undefined;
        body.parceiroDocBanco = parceiroDocBanco || undefined;
      }

      const res = await fetch(`${apiBase}/api/contract/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        setShowForm(false);
        resetForm();
        fetchContracts();
        setConfirmSuccess(`Contrato ${data.data.contractNumber} criado com sucesso!`);
        setTimeout(() => setConfirmSuccess(''), 5000);
      } else {
        if (data.requiresAdminAuth && !formAdminPassword) {
          setFormError('Percentuais personalizados requerem senha master');
        } else {
          setFormError(data.error || 'Erro ao criar contrato');
        }
      }
    } catch {
      setFormError('Erro de conexao');
    } finally {
      setFormLoading(false);
    }
  };

  const handlePreviewContract = async () => {
    if (!selectedClientId) {
      setFormError('Selecione um cliente para preview');
      return;
    }

    try {
      const res = await fetch(`${apiBase}/api/formalization/generate-bipartite-contract`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientId: selectedClientId,
          contractType,
          percentualCliente: pctCliente,
          percentualPlataforma: pctPlataforma,
          percentualParceiro: contractType === 'tripartite' ? pctParceiro : 0,
          taxaAdesao,
          valorEstimado,
          ieCliente,
          advogadoNome: lawyerName,
          advogadoOab: lawyerOab,
          escrowAgencia,
          escrowConta,
          parceiroNome,
          parceiroCnpjCpf,
          parceiroTipoPessoa,
          parceiroOab,
          parceiroEndereco,
          parceiroCidade,
          parceiroUf,
          parceiroBanco,
          parceiroAgencia,
          parceiroConta,
          parceiroTitular,
          parceiroDocBanco,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewText(data.data.contractText);
        setShowPreview(true);
      }
    } catch {
      setFormError('Erro ao gerar preview');
    }
  };

  const handleConfirmPayment = async (contractId: string) => {
    if (!adminPassword) {
      setConfirmError('Digite a senha master');
      return;
    }
    setConfirmLoading(true);
    setConfirmError('');

    try {
      const res = await fetch(`${apiBase}/api/contract/${contractId}/confirm-payment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setConfirmSuccess('Pagamento confirmado! Consulta e formalizacao liberadas.');
        setConfirmModal(null);
        setAdminPassword('');
        fetchContracts();
        setTimeout(() => setConfirmSuccess(''), 5000);
      } else {
        setConfirmError(data.error || 'Erro ao confirmar');
      }
    } catch {
      setConfirmError('Erro de conexao');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleSignContract = async (contractId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/contract/${contractId}/sign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) fetchContracts();
    } catch {}
  };

  const handleViewContract = async (contractId: string) => {
    try {
      const res = await fetch(`${apiBase}/api/contract/${contractId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data.contractText) {
        setPreviewText(data.data.contractText);
        setShowPreview(true);
      }
    } catch {}
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'text-yellow-700 bg-yellow-100',
      generated: 'text-gray-700 bg-gray-200',
      sent_for_signature: 'text-blue-700 bg-blue-100',
      signed: 'text-purple-700 bg-purple-100',
      sent_to_bank: 'text-orange-700 bg-orange-100',
      bank_registered: 'text-emerald-700 bg-emerald-100',
      active: 'text-green-700 bg-green-100',
      completed: 'text-blue-900 bg-blue-200',
      cancelled: 'text-red-700 bg-red-100',
      pending_payment: 'text-orange-700 bg-orange-100',
      payment_claimed: 'text-blue-700 bg-blue-100 animate-pulse',
      pending_signatures: 'text-indigo-700 bg-indigo-100',
    };
    return map[s] || 'text-gray-600 bg-gray-100';
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      draft: 'Rascunho',
      generated: 'Contrato Gerado',
      sent_for_signature: 'Enviado p/ Assinatura',
      signed: 'Assinado (Firma)',
      sent_to_bank: 'Enviado ao Banco',
      bank_registered: 'Cadastrado no Banco',
      active: 'Ativo',
      completed: 'Concluido',
      cancelled: 'Cancelado',
      pending_payment: 'Aguardando Pagamento',
      payment_claimed: 'PAGAMENTO INFORMADO',
      pending_signatures: 'Aguardando Assinatura',
    };
    return map[s] || s;
  };

  const STATUS_FLOW = [
    'draft', 'generated', 'sent_for_signature', 'signed',
    'sent_to_bank', 'bank_registered', 'active', 'completed', 'cancelled',
  ];

  const getNextStatuses = (current: string): string[] => {
    const idx = STATUS_FLOW.indexOf(current);
    if (idx === -1) return STATUS_FLOW;
    return STATUS_FLOW.filter((_, i) => i > idx || STATUS_FLOW[i] === 'cancelled');
  };

  const handleStatusChange = async (contractId: string, newStatus: string) => {
    setStatusDropdownId(null);
    try {
      const res = await fetch(`${apiBase}/api/contract/${contractId}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchContracts();
        if (detailContract?.id === contractId) {
          setDetailContract({ ...detailContract, status: newStatus });
        }
      }
    } catch {}
  };

  const handleOpenDetail = (c: Contract) => {
    setDetailContract(c);
    setChecklistState(c.checklist || {});
  };

  const handleChecklistToggle = async (key: keyof ContractChecklist) => {
    if (!detailContract) return;
    const updated = { ...checklistState, [key]: !checklistState[key] };
    setChecklistState(updated);
    setChecklistSaving(true);

    try {
      const res = await fetch(`${apiBase}/api/contract/${detailContract.id}/checklist`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist: updated }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.autoActivated) {
          setConfirmSuccess('Contrato ATIVADO automaticamente! Analise liberada.');
          setTimeout(() => setConfirmSuccess(''), 5000);
          setDetailContract({ ...detailContract, status: 'active', checklist: updated });
        } else {
          setDetailContract({ ...detailContract, checklist: updated });
        }
        fetchContracts();
      }
    } catch {} finally {
      setChecklistSaving(false);
    }
  };

  const buildMailtoUrl = (c: Contract) => {
    const to = 'ester.souza@bancofibra.com.br,rodrigo.santos@bancofibra.com.br';
    const subject = encodeURIComponent(`Cadastro Operacao Escrow - TaxCredit Enterprise - ${c.clientCompany || c.clientName} - CNPJ ${''}`);
    const isTripartite = c.contractType === 'tripartite';
    const body = encodeURIComponent(
`Prezados Ester e Rodrigo,

Segue contrato de prestacao de servicos de recuperacao de creditos tributarios com firma reconhecida para cadastramento de operacao escrow.

DADOS DA OPERACAO:
Tipo: ${isTripartite ? 'Tripartite' : 'Bipartite'}

PARTE 1 - CONTRATADA:
ATOM BRASIL DIGITAL LTDA
CNPJ: 22.003.550/0001-05

PARTE 2 - CLIENTE:
${c.clientCompany || c.clientName}

${isTripartite ? `PARTE 3 - PARCEIRO:
${c.partnerCompany || c.partnerName || 'N/A'}
` : ''}
PERCENTUAIS DE SPLIT:
Cliente: ${c.clientSplitPercent}%
TaxCredit: ${c.platformSplitPercent}%
${isTripartite ? `Parceiro: ${c.partnerSplitPercent}%` : ''}

Valor estimado da operacao: R$ ${c.estimatedCredits ? c.estimatedCredits.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}

Solicitamos a abertura da conta escrow e configuracao do split automatico conforme percentuais acima.

Atenciosamente,
Felicio Frauches Carega
ATOM BRASIL DIGITAL LTDA
CNPJ: 22.003.550/0001-05`
    );
    return `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const typeLabel = (t: string) => t === 'bipartite' ? 'Bipartite' : 'Tripartite';
  const typeBadge = (t: string) =>
    t === 'bipartite'
      ? 'bg-sky-100 text-sky-700'
      : 'bg-violet-100 text-violet-700';

  const filteredContracts = contracts.filter(c => {
    if (filter !== 'all' && c.contractType !== filter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  const claimedPayments = contracts.filter(c => c.status === 'payment_claimed');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isNonDefault = contractType === 'bipartite'
    ? (pctCliente !== 80 || pctPlataforma !== 20)
    : (pctCliente !== 80 || pctParceiro !== 8 || pctPlataforma !== 12);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
          <p className="text-gray-500 mt-1">Gerencie contratos bipartite e tripartite</p>
        </div>
        <button
          onClick={() => { setShowForm(true); resetForm(); }}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-sm"
        >
          + Gerar Contrato
        </button>
      </div>

      {/* Alerts */}
      {claimedPayments.length > 0 && (
        <div className="mb-6 bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
          <p className="text-blue-800 font-bold text-sm mb-2">
            {claimedPayments.length} cliente(s) informaram pagamento! Verifique e confirme.
          </p>
          {claimedPayments.map(c => (
            <div key={c.id} className="flex items-center justify-between bg-white rounded-lg p-3 mt-2">
              <div>
                <p className="text-gray-900 font-medium text-sm">{c.clientCompany || c.clientName} — {c.contractNumber}</p>
                <p className="text-gray-500 text-xs">Taxa: {formatCurrency(c.setupFee)}</p>
              </div>
              <button
                onClick={() => { setConfirmModal(c.id); setConfirmError(''); setAdminPassword(''); }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-bold rounded-lg"
              >
                Confirmar
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmSuccess && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-green-700 font-medium text-sm">{confirmSuccess}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total', val: contracts.length, color: 'text-gray-900' },
          { label: 'Bipartite', val: contracts.filter(c => c.contractType === 'bipartite').length, color: 'text-sky-600' },
          { label: 'Tripartite', val: contracts.filter(c => c.contractType === 'tripartite').length, color: 'text-violet-600' },
          { label: 'Ativos', val: contracts.filter(c => c.status === 'active').length, color: 'text-green-600' },
          { label: 'Taxas Pagas', val: contracts.filter(c => c.setupFeePaid).length, color: 'text-indigo-600' },
          { label: 'Total Recuperado', val: formatCurrency(contracts.reduce((s, c) => s + (c.totalRecovered || 0), 0)), color: 'text-green-700', isStr: true },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
            <p className="text-gray-500 text-xs">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.isStr ? s.val : s.val}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['all', 'bipartite', 'tripartite'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'bipartite' ? 'Bipartite' : 'Tripartite'}
          </button>
        ))}
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-600 border-0 outline-none"
        >
          <option value="all">Todos Status</option>
          <option value="draft">Rascunho</option>
          <option value="generated">Contrato Gerado</option>
          <option value="sent_for_signature">Env. p/ Assinatura</option>
          <option value="signed">Assinado (Firma)</option>
          <option value="sent_to_bank">Enviado ao Banco</option>
          <option value="bank_registered">Cadastrado Banco</option>
          <option value="active">Ativo</option>
          <option value="completed">Concluido</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {/* Contracts List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {filteredContracts.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500">Nenhum contrato encontrado.</p>
            <p className="text-gray-400 text-sm mt-1">Clique em "Gerar Contrato" para criar um novo.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredContracts.map(c => (
              <div key={c.id} className={`p-4 hover:bg-gray-50 transition-colors ${c.status === 'payment_claimed' ? 'bg-blue-50/50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-gray-900 font-medium">{c.contractNumber}</p>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${typeBadge(c.contractType)}`}>
                        {typeLabel(c.contractType)}
                      </span>
                      {/* Clickable status badge with dropdown */}
                      <div className="relative">
                        <button
                          onClick={() => setStatusDropdownId(statusDropdownId === c.id ? null : c.id)}
                          className={`text-xs px-2 py-0.5 rounded font-semibold cursor-pointer hover:opacity-80 ${statusColor(c.status)}`}
                        >
                          {statusLabel(c.status)}
                        </button>
                        {statusDropdownId === c.id && (
                          <div className="absolute top-6 left-0 z-30 bg-white border border-gray-200 rounded-lg shadow-xl py-1 min-w-[180px]">
                            {getNextStatuses(c.status).map(s => (
                              <button
                                key={s}
                                onClick={() => handleStatusChange(c.id, s)}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
                              >
                                <span className={`w-2 h-2 rounded-full ${statusColor(s).replace('text-', 'bg-').split(' ')[0]}`} />
                                {statusLabel(s)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {c.setupFeePaid && (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-semibold">
                          Taxa Paga
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mt-1">
                      Cliente: <span className="font-medium">{c.clientCompany || c.clientName}</span>
                    </p>
                    {c.contractType === 'tripartite' && (
                      <p className="text-gray-400 text-xs mt-0.5">
                        Parceiro: {c.partnerCompany || c.partnerName || 'N/A'}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      <span>
                        Split: Cliente {c.clientSplitPercent}%
                        {c.contractType === 'tripartite' && <> | Parceiro {c.partnerSplitPercent}%</>}
                        {' | '}TaxCredit {c.platformSplitPercent}%
                      </span>
                      {c.estimatedCredits > 0 && <span>Estimado: {formatCurrency(c.estimatedCredits)}</span>}
                      <span>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 ml-4">
                    <div className="text-right">
                      <p className="text-green-700 font-bold">{formatCurrency(c.totalRecovered || 0)}</p>
                      <p className="text-gray-400 text-xs">recuperado</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <button
                        onClick={() => handleOpenDetail(c)}
                        className="text-xs px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-medium"
                      >
                        Detalhes
                      </button>
                      <button
                        onClick={() => handleViewContract(c.id)}
                        className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                      >
                        Ver Contrato
                      </button>
                      {!c.setupFeePaid && (
                        <button
                          onClick={() => { setConfirmModal(c.id); setConfirmError(''); setAdminPassword(''); }}
                          className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold"
                        >
                          Confirmar Pgto
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* FORM: Gerar Contrato                        */}
      {/* ============================================ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Configurar Contrato</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Type selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo de Contrato</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => switchToType('bipartite')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      contractType === 'bipartite'
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-bold text-gray-900">Bipartite</p>
                    <p className="text-xs text-gray-500 mt-1">TaxCredit + Cliente</p>
                    <p className="text-xs text-gray-400 mt-1">Cliente {80}% | TaxCredit {20}%</p>
                  </button>
                  <button
                    onClick={() => switchToType('tripartite')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      contractType === 'tripartite'
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-bold text-gray-900">Tripartite</p>
                    <p className="text-xs text-gray-500 mt-1">TaxCredit + Cliente + Parceiro</p>
                    <p className="text-xs text-gray-400 mt-1">Cliente {80}% | TaxCredit {12}% | Parceiro {8}%</p>
                  </button>
                </div>
              </div>

              {/* Percentages */}
              <div className="bg-gray-50 rounded-xl p-4">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Distribuicao de Valores (%)</label>
                <div className={`grid ${contractType === 'tripartite' ? 'grid-cols-3' : 'grid-cols-2'} gap-4`}>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">% Cliente</label>
                    <input
                      type="number"
                      min={50} max={90}
                      value={pctCliente}
                      onChange={e => setPctCliente(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-bold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">% TaxCredit</label>
                    <input
                      type="number"
                      value={pctPlataforma}
                      readOnly
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-gray-500 bg-gray-100 text-center font-bold"
                    />
                  </div>
                  {contractType === 'tripartite' && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">% Parceiro</label>
                      <input
                        type="number"
                        min={1} max={20}
                        value={pctParceiro}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setPctParceiro(val);
                          setPctPlataforma(100 - pctCliente - val);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-bold text-center"
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-3">
                  <p className={`text-xs font-semibold ${pctValid ? 'text-green-600' : 'text-red-600'}`}>
                    Soma: {pctSum}% {pctValid ? '(OK)' : '(ERRO: deve ser 100%)'}
                  </p>
                  {pctPlataforma < 0 && (
                    <p className="text-xs text-red-600">TaxCredit nao pode ser negativo!</p>
                  )}
                </div>
                {contractType === 'tripartite' && (
                  <p className="text-xs text-gray-400 mt-1">
                    O parceiro recebe dos {100 - pctCliente}% da TaxCredit, nao afeta o cliente.
                  </p>
                )}
              </div>

              {/* Client selector */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Cliente</label>
                <select
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white"
                >
                  <option value="">Selecione o cliente...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.company || c.name || c.email} {c.cnpj ? `(${c.cnpj})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client IE */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">IE do Cliente</label>
                  <input
                    type="text"
                    value={ieCliente}
                    onChange={e => setIeCliente(e.target.value)}
                    placeholder="Inscricao Estadual"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Valor Estimado de Creditos (R$)</label>
                  <input
                    type="number"
                    value={valorEstimado}
                    onChange={e => setValorEstimado(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  />
                </div>
              </div>

              {/* Tripartite: Partner selector */}
              {contractType === 'tripartite' && (
                <div className="border-t border-gray-200 pt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Parceiro</label>
                  <select
                    value={selectedPartnerId}
                    onChange={e => {
                      setSelectedPartnerId(e.target.value);
                      const p = partners.find(x => x.id === e.target.value);
                      if (p) {
                        setParceiroNome(p.company || p.name);
                        setParceiroCnpjCpf(p.cnpj || '');
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 bg-white mb-3"
                  >
                    <option value="">Selecione o parceiro...</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.company || p.name} {p.cnpj ? `(${p.cnpj})` : ''}
                      </option>
                    ))}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Nome/Razao Social</label>
                      <input type="text" value={parceiroNome} onChange={e => setParceiroNome(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">CNPJ/CPF</label>
                      <input type="text" value={parceiroCnpjCpf} onChange={e => setParceiroCnpjCpf(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tipo Pessoa</label>
                      <select value={parceiroTipoPessoa} onChange={e => setParceiroTipoPessoa(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white">
                        <option value="juridica">Juridica</option>
                        <option value="fisica">Fisica</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">OAB (se advogado)</label>
                      <input type="text" value={parceiroOab} onChange={e => setParceiroOab(e.target.value)}
                        placeholder="RJ 123.456"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Endereco</label>
                      <input type="text" value={parceiroEndereco} onChange={e => setParceiroEndereco(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Cidade</label>
                      <input type="text" value={parceiroCidade} onChange={e => setParceiroCidade(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">UF</label>
                      <input type="text" value={parceiroUf} onChange={e => setParceiroUf(e.target.value)} maxLength={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 font-semibold mt-4 mb-2">Dados Bancarios do Parceiro (Split)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Banco</label>
                      <input type="text" value={parceiroBanco} onChange={e => setParceiroBanco(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Agencia</label>
                      <input type="text" value={parceiroAgencia} onChange={e => setParceiroAgencia(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Conta</label>
                      <input type="text" value={parceiroConta} onChange={e => setParceiroConta(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Titular</label>
                      <input type="text" value={parceiroTitular} onChange={e => setParceiroTitular(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">CPF/CNPJ Titular</label>
                      <input type="text" value={parceiroDocBanco} onChange={e => setParceiroDocBanco(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                    </div>
                  </div>
                </div>
              )}

              {/* Lawyer */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Advogado Vinculado</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Nome Completo</label>
                    <input type="text" value={lawyerName} onChange={e => setLawyerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">OAB (numero e seccional)</label>
                    <input type="text" value={lawyerOab} onChange={e => setLawyerOab(e.target.value)}
                      placeholder="RJ 123.456"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                </div>
              </div>

              {/* Escrow */}
              <div className="border-t border-gray-200 pt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Conta Escrow — Banco Fibra</label>
                <p className="text-xs text-gray-400 mb-3">Banco Fibra S.A. | CNPJ 58.616.418/0001-08</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Agencia</label>
                    <input type="text" value={escrowAgencia} onChange={e => setEscrowAgencia(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Conta</label>
                    <input type="text" value={escrowConta} onChange={e => setEscrowConta(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900" />
                  </div>
                </div>
              </div>

              {/* Setup fee */}
              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Taxa de Adesao (R$)</label>
                    <input
                      type="number"
                      value={taxaAdesao}
                      onChange={e => setTaxaAdesao(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Admin password for non-default splits */}
              {isNonDefault && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <p className="text-amber-700 text-sm font-semibold mb-2">Percentuais personalizados — requer autorizacao</p>
                  <input
                    type="password"
                    value={formAdminPassword}
                    onChange={e => setFormAdminPassword(e.target.value)}
                    placeholder="Senha master..."
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-gray-900"
                  />
                </div>
              )}

              {/* Summary */}
              <div className="bg-indigo-50 rounded-xl p-4">
                <p className="text-indigo-800 text-sm font-bold mb-2">Resumo</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p className="text-gray-600">Tipo:</p>
                  <p className="text-gray-900 font-medium">{typeLabel(contractType)}</p>
                  <p className="text-gray-600">Cliente:</p>
                  <p className="text-gray-900 font-medium">{pctCliente}%</p>
                  <p className="text-gray-600">TaxCredit:</p>
                  <p className="text-gray-900 font-medium">{pctPlataforma}%</p>
                  {contractType === 'tripartite' && (
                    <>
                      <p className="text-gray-600">Parceiro:</p>
                      <p className="text-gray-900 font-medium">{pctParceiro}%</p>
                    </>
                  )}
                  <p className="text-gray-600">Taxa de Adesao:</p>
                  <p className="text-gray-900 font-medium">{formatCurrency(taxaAdesao)}</p>
                  {valorEstimado > 0 && (
                    <>
                      <p className="text-gray-600">Creditos Estimados:</p>
                      <p className="text-gray-900 font-medium">{formatCurrency(valorEstimado)}</p>
                    </>
                  )}
                </div>
                {valorEstimado > 0 && (
                  <div className="mt-3 pt-3 border-t border-indigo-200">
                    <p className="text-xs text-indigo-600 font-semibold">Simulacao sobre estimativa:</p>
                    <p className="text-xs text-gray-600">Cliente: {formatCurrency(valorEstimado * pctCliente / 100)}</p>
                    <p className="text-xs text-gray-600">TaxCredit: {formatCurrency(valorEstimado * pctPlataforma / 100)}</p>
                    {contractType === 'tripartite' && (
                      <p className="text-xs text-gray-600">Parceiro: {formatCurrency(valorEstimado * pctParceiro / 100)}</p>
                    )}
                  </div>
                )}
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-red-600 text-sm">{formError}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handlePreviewContract}
                className="flex-1 py-3 bg-gray-800 hover:bg-gray-900 text-white font-medium rounded-xl"
              >
                Preview
              </button>
              <button
                onClick={handleCreateContract}
                disabled={formLoading || !pctValid || !selectedClientId}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl disabled:opacity-50"
              >
                {formLoading ? 'Gerando...' : 'Gerar Contrato'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* Preview Modal                                */}
      {/* ============================================ */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Preview do Contrato</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const w = window.open('', '_blank');
                    if (w) {
                      w.document.write(`<pre style="font-family:monospace;white-space:pre-wrap;padding:40px;max-width:800px;margin:0 auto">${previewText}</pre>`);
                      w.document.close();
                      w.print();
                    }
                  }}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm rounded-lg font-medium"
                >
                  Imprimir / PDF
                </button>
                <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600 text-2xl px-2">&times;</button>
              </div>
            </div>
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed bg-gray-50 p-6 rounded-xl border border-gray-200">
                {previewText}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* Detail Modal: Checklist + Banco Fibra Card   */}
      {/* ============================================ */}
      {detailContract && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{detailContract.contractNumber}</h2>
                <p className="text-gray-500 text-sm">{detailContract.clientCompany || detailContract.clientName} — {typeLabel(detailContract.contractType)}</p>
              </div>
              <button onClick={() => setDetailContract(null)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Status */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700">Status:</span>
                <span className={`text-sm px-3 py-1 rounded font-bold ${statusColor(detailContract.status)}`}>{statusLabel(detailContract.status)}</span>
              </div>

              {/* Checklist */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Checklist de Acompanhamento</h3>
                <div className="space-y-3">
                  {[
                    { key: 'contract_generated' as const, label: 'Contrato gerado' },
                    { key: 'sent_for_client_signature' as const, label: 'Contrato enviado para assinatura do cliente' },
                    { key: 'client_signed' as const, label: 'Cliente assinou com firma reconhecida' },
                    { key: 'taxcredit_signed' as const, label: 'TaxCredit assinou com firma reconhecida' },
                    ...(detailContract.contractType === 'tripartite'
                      ? [{ key: 'partner_signed' as const, label: 'Parceiro assinou com firma reconhecida' }]
                      : []),
                    { key: 'fee_received' as const, label: `Taxa de adesao recebida (${formatCurrency(detailContract.setupFee)})` },
                    { key: 'sent_to_bank' as const, label: 'Contrato enviado ao Banco Fibra' },
                    { key: 'bank_registered' as const, label: 'Operacao cadastrada pelo Banco Fibra' },
                    { key: 'escrow_active' as const, label: 'Conta escrow ativa' },
                    { key: 'analysis_released' as const, label: 'Analise completa liberada ao cliente' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={!!checklistState[item.key]}
                        onChange={() => handleChecklistToggle(item.key)}
                        disabled={checklistSaving}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className={`text-sm ${checklistState[item.key] ? 'text-green-700 line-through' : 'text-gray-700'} group-hover:text-indigo-700`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
                {checklistSaving && <p className="text-xs text-indigo-500 mt-2 animate-pulse">Salvando...</p>}
                {checklistState.bank_registered && checklistState.fee_received && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-green-700 text-xs font-bold">
                      Banco cadastrado + Taxa recebida = Contrato ATIVADO automaticamente. Analise liberada!
                    </p>
                  </div>
                )}
              </div>

              {/* Banco Fibra Card — shown when signed or later */}
              {['signed', 'sent_to_bank', 'bank_registered', 'active'].includes(detailContract.status) && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-amber-900 mb-3">Enviar ao Banco Fibra para Cadastro da Escrow</h3>
                  <p className="text-xs text-amber-800 mb-3">
                    Envie o contrato assinado com firma reconhecida para:
                  </p>
                  <div className="space-y-2 mb-4">
                    {[
                      { name: 'Ester Souza', email: 'ester.souza@bancofibra.com.br' },
                      { name: 'Rodrigo Santos', email: 'rodrigo.santos@bancofibra.com.br' },
                    ].map(contact => (
                      <div key={contact.email} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-amber-200">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{contact.name}</p>
                          <p className="text-xs text-gray-500">{contact.email}</p>
                        </div>
                        <button
                          onClick={() => navigator.clipboard.writeText(contact.email)}
                          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded"
                          title="Copiar email"
                        >
                          Copiar
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <a
                      href={buildMailtoUrl(detailContract)}
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg text-center"
                    >
                      Abrir Email com Dados
                    </a>
                    {detailContract.status === 'signed' && (
                      <button
                        onClick={() => handleStatusChange(detailContract.id, 'sent_to_bank')}
                        className="px-4 py-2.5 bg-white border border-amber-400 hover:bg-amber-50 text-amber-700 text-sm font-medium rounded-lg"
                      >
                        Marcar como Enviado
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Post-generation instructions — shown right after generating */}
              {['draft', 'generated'].includes(detailContract.status) && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-blue-900 mb-2">Proximo Passo</h3>
                  <p className="text-xs text-blue-800 leading-relaxed">
                    Todas as partes devem assinar o contrato com <strong>FIRMA RECONHECIDA EM CARTORIO</strong> e enviar copia digitalizada para o Banco Fibra para cadastramento da operacao escrow.
                  </p>
                  <p className="text-xs text-blue-700 mt-2">
                    Contatos Banco Fibra: ester.souza@bancofibra.com.br | rodrigo.santos@bancofibra.com.br
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* Confirm Payment Modal                        */}
      {/* ============================================ */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmar Pagamento</h3>
            <p className="text-gray-500 text-sm mb-4">
              Verifique se o PIX foi recebido. Digite sua senha master para confirmar.
            </p>
            <input
              type="password"
              value={adminPassword}
              onChange={e => setAdminPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-green-500 outline-none mb-4"
              placeholder="Senha master..."
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleConfirmPayment(confirmModal)}
            />
            {confirmError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{confirmError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmModal(null); setAdminPassword(''); setConfirmError(''); }}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleConfirmPayment(confirmModal)}
                disabled={confirmLoading || !adminPassword}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50"
              >
                {confirmLoading ? 'Confirmando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
