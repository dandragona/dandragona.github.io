// Shared primitives for the backward-pass staircase components.
// The forward components (ShardingStage, TpStaircase, HybridStaircase) have their
// own inline primitives — kept separate to avoid risk of regression.

export const CHIP_COLORS = ['#2563eb', '#059669', '#7c3aed', '#ea580c'];
export const YELLOW = '#eab308';
export const SLOW = '#dc2626';
export const ABSENT = 'rgba(0, 0, 0, 0.08)';
export const INK = '#1f2937';
export const INK_SOFT = 'rgba(31, 41, 55, 0.6)';
export const CARD_BG = 'rgba(255, 255, 255, 0.35)';
export const CARD_BORDER = 'rgba(31, 41, 55, 0.18)';
export const CELL = 14;
export const GAP = 2;

export function Cell({ fill, stripe }) {
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
        boxSizing: 'border-box',
        border: '1px solid rgba(31, 41, 55, 0.2)',
        transition: 'background 200ms ease',
      }}
    />
  );
}

export function TensorGrid({ name, subtitle, rows, cols, getFill, containerHeight }) {
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
        Step {step} / {totalSteps - 1}
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
