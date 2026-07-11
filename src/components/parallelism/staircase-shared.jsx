// Shared primitives for the step-driven parallelism widgets.
// Consumers: DpBackward, FsdpBackward, TpBackward (backward passes);
// RingAttention, UlyssesAttention, EpAllToAll, EpRing (CP/EP forward);
// and the DP and FSDP-backward variants of OverlapTimeline (gated on
// SCHEMAS.<key>.stepped).
// The forward matmul components (ShardingStage, TpStaircase) have their own
// inline primitives — kept separate to avoid risk of regression.
//
// Cell/TensorGrid take optional `highlight` (yellow "active this tick" ring)
// and `size`/`cellSize` (default CELL=14) props; both default to today's
// behavior, so existing consumers are unaffected. A2A is the all-to-all cyan
// used by CpUlysses / EpRouting / EpBackward. Legend renders a swatch row.

export const CHIP_COLORS = ['#2563eb', '#059669', '#7c3aed', '#ea580c'];
export const YELLOW = '#eab308';
export const A2A = '#0891b2';
export const ABSENT = 'rgba(0, 0, 0, 0.08)';
export const INK = '#1f2937';
export const INK_SOFT = 'rgba(31, 41, 55, 0.6)';
export const CARD_BG = 'rgba(255, 255, 255, 0.35)';
export const CARD_BORDER = 'rgba(31, 41, 55, 0.18)';
export const CELL = 14;
export const GAP = 2;

export function Cell({ fill, stripe, alpha = 1, highlight = false, size = CELL }) {
  const bg = stripe
    ? `repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px), ${fill}`
    : fill;
  return (
    <div
      style={{
        width: size,
        height: size,
        background: bg,
        opacity: alpha,
        borderRadius: 3,
        boxSizing: 'border-box',
        border: highlight ? `2px solid ${highlight === true ? YELLOW : highlight}` : '1px solid rgba(31, 41, 55, 0.2)',
        transition: 'background 200ms ease, opacity 200ms ease, border 200ms ease',
      }}
    />
  );
}

export function TensorGrid({ name, subtitle, rows, cols, getFill, containerHeight, cellSize = CELL, frame }) {
  const cellBlock = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{ display: 'flex', gap: GAP }}>
          {Array.from({ length: cols }, (_, c) => (
            <Cell key={c} size={cellSize} {...getFill(r, c)} />
          ))}
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div
        style={{
          height: containerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {frame ? (
          <div style={{ padding: 2, border: `1.5px solid ${frame}`, borderRadius: 4, boxSizing: 'border-box' }}>
            {cellBlock}
          </div>
        ) : (
          cellBlock
        )}
      </div>
      <div
        style={{
          fontSize: 10,
          color: INK_SOFT,
          fontFamily: 'monospace',
          textAlign: 'center',
          lineHeight: 1.1,
          minHeight: 22,
        }}
      >
        <div>{name}</div>
        <div style={{ fontSize: 8.5, fontStyle: 'italic', opacity: subtitle ? 0.9 : 0 }}>
          {subtitle || '·'}
        </div>
      </div>
    </div>
  );
}

export function OpSymbol({ children, containerHeight }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div
        style={{
          height: containerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          color: INK_SOFT,
          fontWeight: 500,
          minWidth: 8,
        }}
      >
        {children}
      </div>
      <div style={{ fontSize: 10, visibility: 'hidden', minHeight: 22 }}>·</div>
    </div>
  );
}

export function buttonStyle(disabled, primary) {
  return {
    padding: '6px 14px',
    borderRadius: 6,
    background: disabled
      ? 'rgba(255,255,255,0.2)'
      : primary
      ? 'rgba(37, 99, 235, 0.22)'
      : 'rgba(255, 255, 255, 0.4)',
    color: disabled ? INK_SOFT : INK,
    border: `1px solid ${primary && !disabled ? 'rgba(37, 99, 235, 0.45)' : CARD_BORDER}`,
    fontSize: 13,
    cursor: disabled ? 'default' : 'pointer',
    fontWeight: 500,
    transition: 'background 180ms ease',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  };
}

export function StepControls({ step, totalSteps, setStep }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
      <button
        onClick={() => setStep((s) => Math.max(0, s - 1))}
        disabled={step === 0}
        style={buttonStyle(step === 0, false)}
      >
        ← Prev
      </button>
      <div
        style={{
          fontSize: 12,
          color: INK_SOFT,
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          minWidth: 90,
          textAlign: 'center',
        }}
      >
        Step {step + 1} / {totalSteps}
      </div>
      <button
        onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
        disabled={step === totalSteps - 1}
        style={buttonStyle(step === totalSteps - 1, true)}
      >
        Next →
      </button>
      <button onClick={() => setStep(0)} style={{ ...buttonStyle(false, false), marginLeft: 8 }}>
        Reset
      </button>
    </div>
  );
}

export function WidgetShell({ title, subtitle, children }) {
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
        <strong style={{ letterSpacing: '0.02em' }}>{title}</strong>
        <div style={{ fontSize: 12, color: INK_SOFT, marginTop: 6, lineHeight: 1.5 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

export function Caption({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        color: INK_SOFT,
        textAlign: 'center',
        lineHeight: 1.55,
        minHeight: 52,
        padding: '0 12px',
      }}
    >
      {children}
    </div>
  );
}

// Swatch-row legend. Each item: { fill, label, stripe?, ring?, dashed? }.
//   stripe → partial-sum hatch; ring → yellow "active" border;
//   dashed → hollow swatch with a dashed border in `fill` (comm blocks).
export function Legend({ items }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        justifyContent: 'center',
        fontSize: 11,
        color: INK_SOFT,
        flexWrap: 'wrap',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {items.map((it, i) => {
        const bg = it.stripe
          ? `repeating-linear-gradient(45deg, rgba(255,255,255,0.55) 0 2px, transparent 2px 5px), ${it.fill}`
          : it.dashed
          ? 'transparent'
          : it.fill;
        return (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                background: bg,
                borderRadius: 2,
                boxSizing: 'border-box',
                border: it.ring
                  ? `2px solid ${it.ring === true ? YELLOW : it.ring}`
                  : it.dashed
                  ? `1.5px dashed ${it.fill}`
                  : '1px solid rgba(31, 41, 55, 0.2)',
              }}
            />
            {it.label}
          </span>
        );
      })}
    </div>
  );
}
