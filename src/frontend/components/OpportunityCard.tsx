import React, { useState } from 'react';

interface Opportunity {
  tipo: string;
  valorEstimado: number;
  probabilidadeRecuperacao: number;
  fundamentacaoLegal: string;
  descricao: string;
  prazoRecuperacao: string;
}

interface OpportunityCardProps {
  analysisId: string;
  index: number;
  opportunity: Opportunity;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  analysisId,
  index,
  opportunity
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateDocs = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/tax-credit/generate-docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          analysisId,
          opportunityIndex: index
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao gerar documentacao');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `documentacao-credito-${opportunity.tipo}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Redirecionar para menu de formalizacao
      window.location.href = '/formalizacao';
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar documentacao');
    } finally {
      setLoading(false);
    }
  };

  const getProbabilityColor = (prob: number): string => {
    if (prob >= 80) return '#22c55e';
    if (prob >= 50) return '#eab308';
    return '#ef4444';
  };

  return (
    <div style={{
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '24px',
      backgroundColor: '#ffffff',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      transition: 'box-shadow 0.2s',
      maxWidth: '400px'
    }}>
      {/* Tipo do credito */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#1e293b',
          margin: 0
        }}>
          {opportunity.tipo}
        </h3>
        <span style={{
          backgroundColor: getProbabilityColor(opportunity.probabilidadeRecuperacao) + '20',
          color: getProbabilityColor(opportunity.probabilidadeRecuperacao),
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: '600'
        }}>
          {opportunity.probabilidadeRecuperacao}%
        </span>
      </div>

      {/* Valor estimado */}
      <p style={{
        fontSize: '28px',
        fontWeight: '700',
        color: '#0f766e',
        margin: '0 0 8px 0'
      }}>
        R$ {opportunity.valorEstimado.toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}
      </p>

      {/* Prazo */}
      <p style={{
        fontSize: '14px',
        color: '#64748b',
        margin: '0 0 12px 0'
      }}>
        Prazo estimado: {opportunity.prazoRecuperacao}
      </p>

      {/* Fundamentacao legal */}
      <div style={{
        backgroundColor: '#f8fafc',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '16px'
      }}>
        <p style={{
          fontSize: '12px',
          color: '#94a3b8',
          margin: '0 0 4px 0',
          textTransform: 'uppercase',
          fontWeight: '600',
          letterSpacing: '0.5px'
        }}>
          Fundamentacao Legal
        </p>
        <p style={{
          fontSize: '13px',
          color: '#475569',
          margin: 0,
          lineHeight: '1.5'
        }}>
          {opportunity.fundamentacaoLegal}
        </p>
      </div>

      {/* Descricao */}
      <p style={{
        fontSize: '14px',
        color: '#64748b',
        margin: '0 0 20px 0',
        lineHeight: '1.5'
      }}>
        {opportunity.descricao}
      </p>

      {/* Erro */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px'
        }}>
          <p style={{ color: '#dc2626', margin: 0, fontSize: '13px' }}>{error}</p>
        </div>
      )}

      {/* Botao de gerar docs */}
      <button
        onClick={handleGenerateDocs}
        disabled={loading}
        style={{
          width: '100%',
          padding: '12px 20px',
          backgroundColor: loading ? '#94a3b8' : '#0f766e',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        {loading ? 'Gerando...' : 'Gerar Documentacao Completa'}
      </button>
    </div>
  );
};
