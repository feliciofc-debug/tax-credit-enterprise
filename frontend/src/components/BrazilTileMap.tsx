'use client';

/**
 * BrazilTileMap — Cartograma de blocos do Brasil
 * ============================================================
 *
 * Cada UF e' um quadrado de 56x56 posicionado em uma grade que
 * aproxima a geografia do pais (estilo "tile map" FT/Bloomberg).
 *
 * Vantagens vs SVG geografico real:
 *   - Compacto (1 arquivo, ~150 linhas) vs ~1000 linhas de paths
 *   - Todos os estados visualmente equivalentes (sem RR gigante e DF
 *     invisivel) - melhor para destacar STATUS, nao area
 *   - Click direto no UF (button + acessibilidade)
 *   - Animacoes simples e leves
 */

interface TileItem {
  uf: string;
  status: 'covered' | 'planned' | 'pending';
  tier: 'A' | 'B' | 'C';
  pibPct: number;
  nome: string;
  sistema?: string;
}

interface Props {
  items: TileItem[];
  selecionada?: string | null;
  onSelect?: (uf: string) => void;
}

// Posicionamento (col, row) — grade 12 x 9
// Aproxima geografia: Norte em cima, Sul em baixo, Oeste a esquerda
// AC mais a oeste, RN mais a leste (Nordeste), RS mais ao sul.
const TILE_POSITIONS: Record<string, [number, number]> = {
  // Norte - linha de cima
  RR: [4, 0], AP: [6, 0],
  AM: [3, 1], PA: [5, 1], MA: [6, 1], CE: [7, 1], RN: [8, 1],
  AC: [2, 2], RO: [3, 2], TO: [5, 2], PI: [6, 2], PB: [8, 2],
  // Nordeste / Centro
  PE: [7, 3], AL: [8, 3], BA: [6, 4], SE: [8, 4],
  // Centro-Oeste / Sudeste
  MT: [4, 4], GO: [5, 4], DF: [5, 3], MG: [6, 5], ES: [7, 5],
  MS: [4, 5], SP: [5, 6], RJ: [6, 6],
  // Sul
  PR: [5, 7], SC: [5, 8], RS: [4, 8],
};

const STATUS_COLOR: Record<TileItem['status'], { bg: string; border: string; glow: string }> = {
  covered: { bg: '#10b981', border: '#059669', glow: 'rgba(16, 185, 129, 0.4)' },
  planned: { bg: '#f59e0b', border: '#d97706', glow: 'rgba(245, 158, 11, 0.4)' },
  pending: { bg: '#475569', border: '#334155', glow: 'rgba(71, 85, 105, 0.3)' },
};

const TILE = 56;
const GAP = 4;
const COLS = 12;
const ROWS = 9;

export default function BrazilTileMap({ items, selecionada, onSelect }: Props) {
  const byUf = new Map(items.map(i => [i.uf, i]));
  const width = COLS * (TILE + GAP);
  const height = ROWS * (TILE + GAP);

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 0' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ maxWidth: 720, height: 'auto', overflow: 'visible' }}
        role="img"
        aria-label="Mapa do Brasil por status de cobertura SEFAZ"
      >
        {/* Linha conectiva sutil sugerindo regiao Norte-Nordeste */}
        <defs>
          <filter id="glow-covered" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Object.entries(TILE_POSITIONS).map(([uf, [col, row]]) => {
          const it = byUf.get(uf);
          if (!it) return null;
          const c = STATUS_COLOR[it.status];
          const x = col * (TILE + GAP);
          const y = row * (TILE + GAP);
          const isSel = selecionada === uf;
          return (
            <g key={uf} style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.(uf)}>
              <rect
                x={x}
                y={y}
                width={TILE}
                height={TILE}
                rx={8}
                ry={8}
                fill={c.bg}
                stroke={isSel ? '#fff' : c.border}
                strokeWidth={isSel ? 3 : 1.5}
                filter={it.status === 'covered' ? 'url(#glow-covered)' : undefined}
                style={{
                  transition: 'all 120ms ease-out',
                  transform: isSel ? `translate(-2px,-2px)` : undefined,
                }}
              >
                <title>{`${it.nome} (${uf}) — ${it.status === 'covered' ? 'Em producao' : it.status === 'planned' ? 'Planejado' : 'Pendente'} | Tier ${it.tier} | ${it.pibPct.toFixed(1)}% PIB${it.sistema ? ` | ${it.sistema}` : ''}`}</title>
              </rect>
              <text
                x={x + TILE / 2}
                y={y + TILE / 2 - 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="16"
                fontWeight="800"
                fill="#fff"
                pointerEvents="none"
                style={{ userSelect: 'none' }}
              >
                {uf}
              </text>
              <text
                x={x + TILE / 2}
                y={y + TILE - 8}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="rgba(255,255,255,0.8)"
                pointerEvents="none"
                style={{ userSelect: 'none' }}
              >
                {it.tier} · {it.pibPct.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>

      <div style={{ display: 'flex', gap: 16, marginTop: 16, fontSize: 12, color: '#cbd5e1', flexWrap: 'wrap', justifyContent: 'center' }}>
        <LegendItem color={STATUS_COLOR.covered.bg} label="Em producao (tier A/B)" />
        <LegendItem color={STATUS_COLOR.planned.bg} label="Planejado (regras prontas)" />
        <LegendItem color={STATUS_COLOR.pending.bg} label="Pendente" />
        <span style={{ color: '#64748b', fontStyle: 'italic' }}>
          Tile map estilizado · click no UF para detalhes · area NAO proporcional ao territorio
        </span>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 14, height: 14, background: color, borderRadius: 3, display: 'inline-block' }} />
      {label}
    </span>
  );
}
