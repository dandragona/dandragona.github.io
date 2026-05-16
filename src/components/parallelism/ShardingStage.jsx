import { useState } from 'react';

const CHIP_COLORS = ['#2563eb', '#059669', '#7c3aed', '#ea580c'];
const YELLOW = '#eab308';
const REPLICATED = '#9ca3af';
const ABSENT = 'rgba(0, 0, 0, 0.08)';
const INK = '#1f2937';
const INK_SOFT = 'rgba(31, 41, 55, 0.6)';
const CARD_BG = 'rgba(255, 255, 255, 0.35)';
const CARD_BORDER = 'rgba(31, 41, 55, 0.18)';

const CELL = 16;
const GAP = 2;

const STRATEGIES = {
  dp: {
    label: 'Data Parallelism',
    blurb: 'Each chip owns a slice of the batch. W is replicated everywhere.',
    supportsMaterialize: false,
  },
  fsdp: {
    label: 'FSDP',
    blurb:
      "Batch sharded as in DP, but W's rows are partitioned across chips. The full W is gathered just in time, used, and freed.",
    supportsMaterialize: true,
  },
  tp: {
    label: 'Tensor Parallelism (row-parallel)',
    blurb:
      "One shared X, sliced along the contraction dimension E. W's rows are partitioned to match. Each chip computes a full-shape partial sum of Y.",
    supportsReduce: true,
  },
  fsdp_tp: {
    label: 'FSDP + TP (2×2 mesh)',
    blurb:
      "Two-axis mesh: W's rows split along BOTH axes; X's batch split along FSDP; X's contraction split along TP. Forward: AG on FSDP to gather W, then matmul, then RS on TP to reduce the partial-sum output.",
    supportsMaterialize: true,
    supportsReduce: true,
  },
};

function ownsBatchRow(strategy, chipIdx, numChips, B, row) {
  if (strategy === 'dp' || strategy === 'fsdp') {
    const rowsPerChip = B / numChips;
    return Math.floor(row / rowsPerChip) === chipIdx;
  }
  if (strategy === 'fsdp_tp') {
    const fsdpRank = Math.floor(chipIdx / 2);
    const rowsPerFsdp = B / 2;
    return Math.floor(row / rowsPerFsdp) === fsdpRank;
  }
  return false;
}

function ownsWRow(strategy, chipIdx, row) {
  if (strategy === 'fsdp' || strategy === 'tp') return row === chipIdx;
  if (strategy === 'fsdp_tp') {
    // TP-outer indexing: rows split first by TP rank (rows {0,1} = TP 0,
    // rows {2,3} = TP 1), then by FSDP rank within each TP block.
    // This makes the post-AG view contiguous — each TP rank gets a
    // contiguous half of W's rows.
    const fsdpRank = Math.floor(chipIdx / 2);
    const tpRank = chipIdx % 2;
    return row === 2 * tpRank + fsdpRank;
  }
  return false;
}

function ownsContractionCol(strategy, chipIdx, E, col) {
  if (strategy === 'tp') return col === chipIdx;
  if (strategy === 'fsdp_tp') {
    const tpRank = chipIdx % 2;
    const colsPerTp = E / 2;
    return Math.floor(col / colsPerTp) === tpRank;
  }
  return false;
}

function ownsYOutputCol(strategy, chipIdx, E, col) {
  if (strategy === 'tp') return col === chipIdx;
  if (strategy === 'fsdp_tp') {
    const tpRank = chipIdx % 2;
    const colsPerTp = E / 2;
    return Math.floor(col / colsPerTp) === tpRank;
  }
  return false;
}

function Cell({ fill, stripe }) {
  const bg = stripe
    ? `repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px), ${fill}`
    : fill;
  return (
    <div
      style={{
        width: CELL,
        height: CELL,
        background: bg,
        borderRadius: 3,
        border: '1px solid rgba(31, 41, 55, 0.2)',
        transition: 'background 200ms ease',
      }}
    />
  );
}

function TensorGrid({ name, rows, cols, getFill, containerHeight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          height: containerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} style={{ display: 'flex', gap: GAP }}>
              {Array.from({ length: cols }, (_, c) => (
                <Cell key={c} {...getFill(r, c)} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 11, color: INK_SOFT, fontFamily: 'monospace' }}>{name}</div>
    </div>
  );
}

function OpSymbol({ children, containerHeight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div
        style={{
          height: containerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: INK_SOFT,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 500,
          minWidth: 12,
        }}
      >
        {children}
      </div>
      <div style={{ fontSize: 11, visibility: 'hidden' }}>·</div>
    </div>
  );
}

function getFills({ strategy, chipIdx, numChips, B, E, materialized, reduced }) {
  const chipColor = CHIP_COLORS[chipIdx % CHIP_COLORS.length];

  const xFill = (r, c) => {
    if (strategy === 'tp') {
      return c === chipIdx ? { fill: chipColor } : { fill: ABSENT };
    }
    if (strategy === 'fsdp_tp') {
      const ownsR = ownsBatchRow(strategy, chipIdx, numChips, B, r);
      const ownsC = ownsContractionCol(strategy, chipIdx, E, c);
      return ownsR && ownsC ? { fill: chipColor } : { fill: ABSENT };
    }
    return ownsBatchRow(strategy, chipIdx, numChips, B, r)
      ? { fill: chipColor }
      : { fill: ABSENT };
  };

  const wFill = (r) => {
    if (strategy === 'fsdp_tp') {
      if (materialized) {
        // After AG of W along the FSDP axis, each TP rank pools its FSDP shards
        // into a contiguous half of W's rows. tpRank 0 → rows {0,1}, tpRank 1 → rows {2,3}.
        const tpRank = chipIdx % 2;
        return Math.floor(r / 2) === tpRank ? { fill: YELLOW } : { fill: ABSENT };
      }
      return ownsWRow(strategy, chipIdx, r)
        ? { fill: chipColor }
        : { fill: ABSENT };
    }
    if (materialized) return { fill: YELLOW };
    if (strategy === 'dp') return { fill: YELLOW };
    return ownsWRow(strategy, chipIdx, r)
      ? { fill: chipColor }
      : { fill: ABSENT };
  };

  const yFill = (r, c) => {
    if (strategy === 'tp') {
      if (reduced) {
        return c === chipIdx ? { fill: chipColor } : { fill: ABSENT };
      }
      return { fill: chipColor, stripe: true };
    }
    if (strategy === 'fsdp_tp') {
      // Y is empty until W has been gathered (matmul can't run otherwise).
      if (!materialized) return { fill: ABSENT };
      const ownsR = ownsBatchRow(strategy, chipIdx, numChips, B, r);
      if (!ownsR) return { fill: ABSENT };
      if (reduced) {
        return ownsYOutputCol(strategy, chipIdx, E, c)
          ? { fill: chipColor }
          : { fill: ABSENT };
      }
      // Post-matmul, pre-RS: partial sum at full output shape.
      return { fill: chipColor, stripe: true };
    }
    if (strategy === 'fsdp' && !materialized) {
      return { fill: ABSENT };
    }
    return ownsBatchRow(strategy, chipIdx, numChips, B, r)
      ? { fill: chipColor }
      : { fill: ABSENT };
  };

  return { xFill, wFill, yFill };
}

function Chip({ chipIdx, numChips, strategy, B, E, materialized, reduced }) {
  const { xFill, wFill, yFill } = getFills({
    strategy,
    chipIdx,
    numChips,
    B,
    E,
    materialized,
    reduced,
  });
  const maxRows = Math.max(B, E);
  const containerHeight = maxRows * CELL + (maxRows - 1) * GAP;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '10px 8px',
        borderRadius: 14,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: INK_SOFT,
          fontWeight: 600,
        }}
      >
        Chip {chipIdx}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
        <TensorGrid name="X" rows={B} cols={E} getFill={xFill} containerHeight={containerHeight} />
        <OpSymbol containerHeight={containerHeight}>@</OpSymbol>
        <TensorGrid name="W" rows={E} cols={E} getFill={wFill} containerHeight={containerHeight} />
        <OpSymbol containerHeight={containerHeight}>=</OpSymbol>
        <TensorGrid name="Y" rows={B} cols={E} getFill={yFill} containerHeight={containerHeight} />
      </div>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          background: color,
          borderRadius: 2,
          border: '1px solid rgba(31, 41, 55, 0.2)',
        }}
      />
      {label}
    </span>
  );
}

export default function ShardingStage({
  numChips = 2,
  strategy = 'dp',
  B = 4,
  E = 2,
  initialMaterialized = false,
}) {
  const [materialized, setMaterialized] = useState(initialMaterialized);
  const [reduced, setReduced] = useState(false);
  const cfg = STRATEGIES[strategy] ?? STRATEGIES.dp;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '20px 16px',
        borderRadius: 16,
        background: 'rgba(255, 255, 255, 0.18)',
        border: `1px solid ${CARD_BORDER}`,
        margin: '28px 0',
        color: INK,
      }}
    >
      <div style={{ textAlign: 'center', fontSize: 13, color: INK }}>
        <strong style={{ letterSpacing: '0.04em' }}>{cfg.label}</strong>
        <span style={{ color: INK_SOFT }}> — {cfg.blurb}</span>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {Array.from({ length: numChips }, (_, i) => (
          <Chip
            key={i}
            chipIdx={i}
            numChips={numChips}
            strategy={strategy}
            B={B}
            E={E}
            materialized={materialized}
            reduced={reduced}
          />
        ))}
      </div>

      {cfg.supportsMaterialize && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setMaterialized((v) => !v)}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              background: materialized ? YELLOW : 'rgba(255, 255, 255, 0.4)',
              color: INK,
              border: `1px solid ${CARD_BORDER}`,
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'background 200ms ease',
            }}
          >
            {materialized ? 'Re-shard W' : 'All-gather W (materialize)'}
          </button>
        </div>
      )}

      {cfg.supportsReduce && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            onClick={() => setReduced((v) => !v)}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              background: reduced ? 'rgba(37, 99, 235, 0.25)' : 'rgba(255, 255, 255, 0.4)',
              color: INK,
              border: `1px solid ${reduced ? 'rgba(37, 99, 235, 0.45)' : CARD_BORDER}`,
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'background 200ms ease, border 200ms ease',
            }}
          >
            {reduced ? 'Undo reduce-scatter' : 'Reduce-scatter Y'}
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 18,
          justifyContent: 'center',
          fontSize: 11,
          color: INK_SOFT,
          flexWrap: 'wrap',
        }}
      >
        <LegendDot color={CHIP_COLORS[0]} label="this chip's shard" />
        <LegendDot color={REPLICATED} label="replicated" />
        <LegendDot color={YELLOW} label="materialized" />
        <LegendDot
          color={`repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px), ${CHIP_COLORS[0]}`}
          label="partial sum"
        />
        <LegendDot color="rgba(31, 41, 55, 0.15)" label="elsewhere" />
      </div>
    </div>
  );
}
