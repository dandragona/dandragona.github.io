import { useState } from 'react';
import './diagram-kit.css';

// Operations per value moved, per device, for one layer over a training step.
// The formulas are the estimates worked out in each section, with constants.

const SLIDERS = [
  { id: 'T', name: 'tokens per step', min: 12, max: 22, initial: 20 },
  { id: 'S', name: 'sequence length', min: 10, max: 20, initial: 15 },
  { id: 'E', name: 'hidden width', min: 10, max: 15, initial: 13 },
  { id: 'P', name: 'devices in the group', min: 1, max: 10, initial: 3 },
  { id: 'k', name: 'experts per token', min: 1, max: 8, initial: 2, linear: true },
];

const METHODS = [
  { name: 'Data parallelism', formula: '3T/P', ratio: (v) => (3 * v.T) / v.P },
  { name: 'FSDP', formula: '2T/P', ratio: (v) => (2 * v.T) / v.P },
  { name: 'Tensor parallelism', formula: '3E/P', ratio: (v) => (3 * v.E) / v.P },
  { name: 'Ring attention', formula: '2S/P', ratio: (v) => (2 * v.S) / v.P },
  { name: 'Ulysses attention', formula: '1.5S', ratio: (v) => 1.5 * v.S },
  { name: 'Expert all-to-all', formula: '1.5E', ratio: (v) => 1.5 * v.E },
  { name: 'Expert gather/scatter', formula: '1.5kE/P', ratio: (v) => (1.5 * v.k * v.E) / v.P },
];

// The bars use a log scale from 1 to 10 million.
const MAX_DECADES = 7;
const TICKS = [
  [0, '1'],
  [2, '100'],
  [4, '10K'],
  [6, '1M'],
];

const value = (slider, setting) => (slider.linear ? setting : 2 ** setting);

function formatPowerOfTwo(n) {
  if (n >= 2 ** 20) return `${n / 2 ** 20}M`;
  if (n >= 2 ** 10) return `${n / 2 ** 10}K`;
  return String(n);
}

function formatRatio(n) {
  const short = (x) => String(Number(x.toPrecision(3)));
  if (n >= 1e6) return `${short(n / 1e6)}M`;
  if (n >= 1e4) return `${short(n / 1e3)}K`;
  if (n >= 10) return Math.round(n).toLocaleString('en-US');
  return short(n);
}

export default function RatioExplorer() {
  const [settings, setSettings] = useState(() => Object.fromEntries(SLIDERS.map((s) => [s.id, s.initial])));

  // T counts every position of every sequence, so it can't be smaller than S.
  const change = (id, setting) =>
    setSettings((current) => {
      const next = { ...current, [id]: setting };
      if (id === 'S' && setting > next.T) next.T = setting;
      if (id === 'T' && setting < next.S) next.S = setting;
      return next;
    });

  const values = Object.fromEntries(SLIDERS.map((s) => [s.id, value(s, settings[s.id])]));

  return (
    <figure className="pd-figure pd-explorer">
      <div className="pd-sliders">
        {SLIDERS.map((slider) => {
          const shown = formatPowerOfTwo(values[slider.id]);
          return (
            <label key={slider.id} className="pd-slider">
              <span className="pd-slider-head">
                <span>
                  {slider.id}: {slider.name}
                </span>
                <span className="pd-slider-value">{shown}</span>
              </span>
              <input
                type="range"
                min={slider.min}
                max={slider.max}
                step={1}
                value={settings[slider.id]}
                aria-valuetext={shown}
                onChange={(event) => change(slider.id, Number(event.target.value))}
              />
            </label>
          );
        })}
      </div>
      <div className="pd-bars">
        {METHODS.map((method) => {
          const ratio = method.ratio(values);
          const share = Math.min(1, Math.max(0.01, Math.log10(Math.max(ratio, 1)) / MAX_DECADES));
          return (
            <div key={method.name} className="pd-bar-row">
              <span className="pd-bar-head">
                <span>
                  {method.name} <span className="pd-bar-formula">{method.formula}</span>
                </span>
                <span>{formatRatio(ratio)}</span>
              </span>
              <span className="pd-bar-track">
                <span className="pd-bar-fill" style={{ width: `${share * 100}%` }} />
              </span>
            </div>
          );
        })}
        <div className="pd-bar-axis" aria-hidden="true">
          {TICKS.map(([decade, text]) => (
            <span key={text} style={{ left: `${(decade / MAX_DECADES) * 100}%` }}>
              {text}
            </span>
          ))}
        </div>
        <p className="pd-bar-note">Operations per value moved, log scale</p>
      </div>
    </figure>
  );
}
