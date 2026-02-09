import React, { useState, useEffect } from 'react';

interface PerdcompData {
  codigoReceita: string;
  periodoApuracao: string;
  valorCredito: number;
  naturezaCredito: string;
  fundamentacaoLegal: string;
}

interface EcacResponse {
  perdcompData: PerdcompData;
  instructions: string[];
  estimatedProcessingTime: string;
}

interface TaxCreditProcess {
  id: string;
  analysisId: string;
  opportunityIndex: number;
  opportunityType: string;
  estimatedValue: number;
  status: string;
  protocolNumber?: string;
  protocolDate?: string;
}

export const FormalizacaoPage: React.FC = () => {
  const [processes, setProcesses] = useState<TaxCreditProcess[]>([]);
  const [showEcacModal, setShowEcacModal] = useState(false);
  const [ecacData, setEcacData] = useState<EcacResponse | null>(null);
  const [loadingEcac, setLoadingEcac] = useState(false);
  const [protocolInputs, setProtocolInputs] = useState<{ [key: string]: string }>({});
  const [savingProtocol, setSavingProtocol] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Checklist por processo
  const [checklists, setChecklists] = useState<{ [processId: string]: { [item: string]: boolean } }>({});

  const token = localStorage.getItem('token');

  const defaultChecklistItems = [
    'Notas fiscais separadas',
    'SPED transmitido',
    'Certificado digital valido',
    'Procuracao eletronica (se aplicavel)',
    'Memoria de calculo revisada',
    'Parecer tecnico conferido'
  ];

  const handleViewEcacData = async (analysisId: string, oppIndex: number) => {
    setLoadingEcac(true);
    try {
      const res = await fetch('/api/tax-credit/prepare-perdcomp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ analysisId, opportunityIndex: oppIndex })
      });

      const data = await res.json();
      if (data.success) {
        setEcacData(data.data);
        setShowEcacModal(true);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do e-CAC:', error);
    } finally {
      setLoadingEcac(false);
    }
  };

  const handleSaveProtocol = async (processId: string) => {
    const protocolNumber = protocolInputs[processId];
    if (!protocolNumber) return;

    setSavingProtocol(processId);
    try {
      // Aqui voce integraria com seu backend para salvar o protocolo
      // Por enquanto simulamos o salvamento
      setProcesses(prev =>
        prev.map(p =>
          p.id === processId
            ? { ...p, protocolNumber, protocolDate: new Date().toISOString(), status: 'filed' }
            : p
        )
      );
      setProtocolInputs(prev => ({ ...prev, [processId]: '' }));
    } catch (error) {
      console.error('Erro ao salvar protocolo:', error);
    } finally {
      setSavingProtocol(null);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleChecklistItem = (processId: string, item: string) => {
    setChecklists(prev => ({
      ...prev,
      [processId]: {
        ...prev[processId],
        [item]: !prev[processId]?.[item]
      }
    }));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { label: string; color: string; bg: string } } = {
      'docs_generated': { label: 'Docs Gerados', color: '#2563eb', bg: '#dbeafe' },
      'ready_to_file': { label: 'Pronto p/ Protocolar', color: '#d97706', bg: '#fef3c7' },
      'filed': { label: 'Protocolado', color: '#7c3aed', bg: '#ede9fe' },
      'approved': { label: 'Aprovado', color: '#16a34a', bg: '#dcfce7' },
      'rejected': { label: 'Indeferido', color: '#dc2626', bg: '#fee2e2' }
    };

    const config = statusConfig[status] || statusConfig['docs_generated'];

    return (
      <span style={{
        backgroundColor: config.bg,
        color: config.color,
        padding: '4px 12px',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '600'
      }}>
        {config.label}
      </span>
    );
  };

  const getChecklistProgress = (processId: string): number => {
    const checks = checklists[processId] || {};
    const checked = Object.values(checks).filter(Boolean).length;
    return Math.round((checked / defaultChecklistItems.length) * 100);
  };

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '32px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#1e293b',
          margin: '0 0 8px 0'
        }}>
          Menu de Formalizacao
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#64748b',
          margin: 0
        }}>
          Gerencie seus processos de recuperacao de credito tributario
        </p>
      </div>

      {/* Lista de processos */}
      {processes.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#f8fafc',
          borderRadius: '12px',
          border: '2px dashed #e2e8f0'
        }}>
          <p style={{ fontSize: '16px', color: '#94a3b8', margin: '0 0 8px 0' }}>
            Nenhum processo de formalizacao ainda
          </p>
          <p style={{ fontSize: '14px', color: '#cbd5e1', margin: 0 }}>
            Gere documentacao a partir de uma oportunidade identificada para comecar
          </p>
        </div>
      ) : (
        processes.map((process) => (
          <div
            key={process.id}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '24px',
              marginBottom: '20px',
              backgroundColor: '#ffffff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            {/* Cabecalho do processo */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#1e293b',
                  margin: '0 0 4px 0'
                }}>
                  {process.opportunityType}
                </h3>
                <p style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#0f766e',
                  margin: 0
                }}>
                  R$ {process.estimatedValue.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </p>
              </div>
              {getStatusBadge(process.status)}
            </div>

            {/* Checklist */}
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#475569',
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Checklist de Validacao
                </h4>
                <span style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: getChecklistProgress(process.id) === 100 ? '#16a34a' : '#64748b'
                }}>
                  {getChecklistProgress(process.id)}%
                </span>
              </div>

              {/* Barra de progresso */}
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#e2e8f0',
                borderRadius: '2px',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: `${getChecklistProgress(process.id)}%`,
                  height: '100%',
                  backgroundColor: getChecklistProgress(process.id) === 100 ? '#16a34a' : '#3b82f6',
                  borderRadius: '2px',
                  transition: 'width 0.3s ease'
                }} />
              </div>

              {defaultChecklistItems.map((item) => (
                <label
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 0',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: checklists[process.id]?.[item] ? '#16a34a' : '#475569'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checklists[process.id]?.[item] || false}
                    onChange={() => toggleChecklistItem(process.id, item)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{
                    textDecoration: checklists[process.id]?.[item] ? 'line-through' : 'none'
                  }}>
                    {item}
                  </span>
                </label>
              ))}
            </div>

            {/* Acoes */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '16px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => handleViewEcacData(process.analysisId, process.opportunityIndex)}
                disabled={loadingEcac}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {loadingEcac ? 'Carregando...' : 'Ver Dados para e-CAC'}
              </button>
            </div>

            {/* Input de protocolo */}
            {process.status !== 'filed' && process.status !== 'approved' && (
              <div style={{
                display: 'flex',
                gap: '12px',
                alignItems: 'center'
              }}>
                <input
                  type="text"
                  placeholder="Numero do protocolo"
                  value={protocolInputs[process.id] || ''}
                  onChange={(e) => setProtocolInputs(prev => ({
                    ...prev,
                    [process.id]: e.target.value
                  }))}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={() => handleSaveProtocol(process.id)}
                  disabled={!protocolInputs[process.id] || savingProtocol === process.id}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: protocolInputs[process.id] ? '#16a34a' : '#94a3b8',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: protocolInputs[process.id] ? 'pointer' : 'not-allowed',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {savingProtocol === process.id ? 'Salvando...' : 'Salvar Protocolo'}
                </button>
              </div>
            )}

            {/* Protocolo salvo */}
            {process.protocolNumber && (
              <div style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '12px 16px',
                marginTop: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <p style={{ fontSize: '12px', color: '#16a34a', margin: '0 0 2px 0', fontWeight: '600' }}>
                    PROTOCOLO REGISTRADO
                  </p>
                  <p style={{ fontSize: '15px', color: '#166534', margin: 0, fontWeight: '600' }}>
                    {process.protocolNumber}
                  </p>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  {process.protocolDate
                    ? new Date(process.protocolDate).toLocaleDateString('pt-BR')
                    : ''
                  }
                </p>
              </div>
            )}
          </div>
        ))
      )}

      {/* Modal e-CAC */}
      {showEcacModal && ecacData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            {/* Header do modal */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#1e293b',
                margin: 0
              }}>
                Dados para e-CAC
              </h2>
              <button
                onClick={() => setShowEcacModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px'
                }}
              >
                X
              </button>
            </div>

            {/* Dados do PER/DCOMP */}
            <div style={{
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                margin: '0 0 12px 0',
                textTransform: 'uppercase'
              }}>
                Dados PER/DCOMP
              </h3>

              {[
                { label: 'Codigo Receita', value: ecacData.perdcompData.codigoReceita },
                { label: 'Periodo Apuracao', value: ecacData.perdcompData.periodoApuracao },
                {
                  label: 'Valor do Credito',
                  value: `R$ ${ecacData.perdcompData.valorCredito.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2
                  })}`
                },
                { label: 'Natureza do Credito', value: ecacData.perdcompData.naturezaCredito },
                { label: 'Fundamentacao Legal', value: ecacData.perdcompData.fundamentacaoLegal }
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  <span style={{ fontSize: '13px', color: '#64748b' }}>{item.label}</span>
                  <span style={{ fontSize: '14px', color: '#1e293b', fontWeight: '600' }}>
                    {item.value}
                  </span>
                </div>
              ))}

              <button
                onClick={() => handleCopyToClipboard(JSON.stringify(ecacData.perdcompData, null, 2))}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  backgroundColor: copied ? '#16a34a' : '#e2e8f0',
                  color: copied ? '#ffffff' : '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                {copied ? 'Copiado!' : 'Copiar Dados'}
              </button>
            </div>

            {/* Instrucoes passo a passo */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#475569',
                margin: '0 0 12px 0',
                textTransform: 'uppercase'
              }}>
                Passo a Passo
              </h3>

              {ecacData.instructions.map((instruction, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    padding: '8px 0'
                  }}
                >
                  <span style={{
                    minWidth: '24px',
                    height: '24px',
                    backgroundColor: '#dbeafe',
                    color: '#2563eb',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '700'
                  }}>
                    {i + 1}
                  </span>
                  <p style={{
                    fontSize: '14px',
                    color: '#475569',
                    margin: 0,
                    lineHeight: '1.5'
                  }}>
                    {instruction}
                  </p>
                </div>
              ))}
            </div>

            {/* Tempo estimado */}
            <div style={{
              backgroundColor: '#fefce8',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              border: '1px solid #fef08a'
            }}>
              <p style={{ fontSize: '13px', color: '#a16207', margin: 0 }}>
                <strong>Prazo estimado de processamento:</strong> {ecacData.estimatedProcessingTime}
              </p>
            </div>

            {/* Botoes do modal */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => window.open('https://cav.receita.fazenda.gov.br', '_blank')}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Abrir e-CAC
              </button>
              <button
                onClick={() => setShowEcacModal(false)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
