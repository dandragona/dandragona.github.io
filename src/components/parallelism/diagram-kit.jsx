// Shared parts for the parallelism diagrams: colors, moving cells, the step
// line, and step controls. A diagram describes every cell for the current step
// and gives each one a stable key, so changing step slides cells to new places.

import { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import './diagram-kit.css';

export const DEVICE_COLORS = ['#2563eb', '#059669', '#7c3aed', '#ea580c'];
export const COPY_COLOR = '#64748b';
export const NEUTRAL_COLOR = '#78716c';
export const ZERO_COLOR = 'rgba(255, 255, 255, 0.7)';
export const EMPTY_COLOR = 'rgba(41, 37, 36, 0.1)';
export const INK = '#292524';

const HatchContext = createContext(null);

export function useFigureWidth(initialWidth = 800) {
  const ref = useRef(null);
  const [width, setWidth] = useState(initialWidth);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const node = ref.current;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    // Motion starts after the first measured layout, so cells don't slide on load.
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, []);

  return { ref, width, animated };
}

export function Figure({ figureRef, animated, children }) {
  return (
    <figure ref={figureRef} className={animated ? 'pd-figure pd-animated' : 'pd-figure'}>
      {children}
    </figure>
  );
}

export function DiagramSvg({ width, height, label, children }) {
  const hatchId = `pd-hatch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg
      className="pd-svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      <defs>
        <pattern
          id={hatchId}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="2.5" height="6" fill="rgba(255, 255, 255, 0.6)" />
        </pattern>
      </defs>
      <HatchContext.Provider value={hatchId}>{children}</HatchContext.Provider>
    </svg>
  );
}

// An empty place a cell can occupy. Drawn under the moving cells.
export function Slot({ x, y, size }) {
  return <rect x={x} y={y} width={size} height={size} rx={3} fill={EMPTY_COLOR} />;
}

// `arriving` delays any opacity change until a moving cell reaches its target,
// so a sent cell vanishes on arrival and a result appears when its inputs land.
// `late` delays fill, hatch, and label changes the same way, for a cell that
// something else is moving into. `jump` fades a cell in place instead of
// sliding it, for a move that would otherwise cross other devices.
export function Cell({
  x,
  y,
  size,
  fill,
  hatched = false,
  opacity = 1,
  outlined = false,
  arriving = false,
  late = false,
  jump = false,
  label,
  labelInk = false,
}) {
  const hatchId = useContext(HatchContext);
  const classes = ['pd-cell'];
  if (arriving) classes.push('pd-cell-arriving');
  if (late) classes.push('pd-cell-late');
  if (jump) classes.push('pd-cell-jump');
  return (
    <g className={classes.join(' ')} style={{ transform: `translate(${x}px, ${y}px)`, opacity }}>
      <rect
        className="pd-cell-fill"
        width={size}
        height={size}
        rx={3}
        style={{ fill }}
        stroke={outlined ? INK : 'none'}
        strokeWidth={outlined ? 2 : 0}
      />
      <rect
        className="pd-cell-hatch"
        width={size}
        height={size}
        rx={3}
        fill={`url(#${hatchId})`}
        style={{ opacity: hatched ? 1 : 0 }}
      />
      {label !== undefined && (
        // Keyed by its text, so a new label mounts and fades in after a delay.
        <text
          key={label}
          className={labelInk ? 'pd-cell-label pd-cell-label-ink' : 'pd-cell-label'}
          x={size / 2}
          y={size / 2 + 4}
          textAnchor="middle"
        >
          {label}
        </text>
      )}
    </g>
  );
}

// Keeps hyphenated words such as "all-reduce" on one line.
function keepHyphenatedWords(line) {
  if (typeof line !== 'string') return line;
  return line
    .split(/(\S+-\S+)/)
    .map((part, i) => (i % 2 ? <span key={i} className="pd-nowrap">{part}</span> : part));
}

// Every line stays in the layout, so the figure is as tall as its longest line
// at any width and the controls below it never move. `reserve` holds lines from
// other modes of the same figure, so switching modes doesn't move them either.
export function StepLine({ lines, step, reserve = [] }) {
  return (
    <p className="pd-step-line" aria-live="polite">
      {lines.map((line, i) => (
        <span key={i} className={i === step ? 'is-current' : undefined}>
          {keepHyphenatedWords(line)}
        </span>
      ))}
      {reserve.map((line, i) => (
        <span key={`reserve-${i}`} aria-hidden="true">
          {keepHyphenatedWords(line)}
        </span>
      ))}
    </p>
  );
}

// Each option: { value, label }.
export function Toggle({ label, options, value, onChange }) {
  return (
    <div className="pd-toggle-group" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          className="pd-toggle"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function StepControls({ step, total, onStep }) {
  const last = step === total - 1;
  return (
    <div className="pd-controls" role="group" aria-label="Diagram steps">
      <button type="button" className="pd-button" disabled={step === 0} onClick={() => onStep(step - 1)}>
        ← Back
      </button>
      <span className="pd-count" aria-label={`Step ${step + 1} of ${total}`}>
        {step + 1} / {total}
      </span>
      <button type="button" className="pd-button pd-button-next" onClick={() => onStep(last ? 0 : step + 1)}>
        {last ? 'Restart' : 'Next →'}
      </button>
    </div>
  );
}

// Each item: { fill, hatched?, stroke?, dashed?, label }. A dashed item is a
// vertical dashed line instead of a swatch.
export function Legend({ items }) {
  return (
    <div className="pd-legend">
      {items.map((item) => {
        const classes = ['pd-swatch'];
        if (item.hatched) classes.push('pd-swatch-hatched');
        if (item.dashed) classes.push('pd-swatch-dashed');
        const style = item.dashed
          ? undefined
          : { backgroundColor: item.fill, border: item.stroke ? `1px solid ${item.stroke}` : undefined };
        return (
          <span key={item.label} className="pd-legend-item">
            <span className={classes.join(' ')} style={style} />
            {item.label}
          </span>
        );
      })}
    </div>
  );
}
