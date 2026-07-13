import { useState } from 'react';
import {
  CHIP_COLORS,
  YELLOW,
  A2A,
  ABSENT,
  INK_SOFT,
  CARD_BG,
  CARD_BORDER,
  CELL,
  GAP,
  TensorGrid,
  OpSymbol,
  StepControls,
  WidgetShell,
  Caption,
  Legend,
} from './staircase-shared.jsx';

// Ulysses attention (forward). Four devices, sequence-sharded. Every grid
// drawn is the FULL logical tensor [S=8 tokens x A=4 heads] — sharding is
// which cells are resident (device color) vs elsewhere (ABSENT), never a
// change of grid shape. Device d's shard is a horizontal band of its 2 token
// rows (seq-sharded) that flips to a full vertical column d (head-sharded)
// across the two all-to-alls and flips back. Cell color = the device that
// owns that token's sequence position, so ownership is traceable through
// both transposes.

const P = 4;
const S = 8;
const SP = 2; // S/P tokens per device
const A = 4; // heads
const E = 2;
const GRID_H = S * CELL + (S - 1) * GAP; // 126 — shared containerHeight for every grid
const CONTENT_W = 196; // widest row: X[8x2] @ W_qkv[2x4] = QKV[8x4]
const TOTAL_STEPS = 6;
const COMPUTE = '#92400e';

const owner = (r) => Math.floor(r / SP);

const PHASES = [
  { label: 'sequence-sharded', accent: INK_SOFT },
  { label: 'local Q,K,V projection', accent: COMPUTE },
  { label: 'all-to-all #1 · seq → heads', accent: A2A },
  { label: 'local attention', accent: COMPUTE },
  { label: 'all-to-all #2 · heads → seq', accent: A2A },
  { label: 'concat + output projection', accent: COMPUTE },
];

const CAPTIONS = [
  "Sequence-sharded, exactly like the dense layers before it: device d owns two of the eight token rows of X [S/P, E], and W_qkv is replicated (yellow). Q,K,V is not computed yet — every grid drawn is the full logical tensor, and pale cells simply live elsewhere.",
  "Each device projects the tokens it already holds: X @ W_qkv fills in device d's two rows of Q,K,V across all A = 4 head columns — [S/P, A·H], read heads-out as [A, S/P, H] for attention. (Q, K and V shard identically, so one grid stands for all three.) A horizontal band: my tokens, every head — but attention needs every token, so no device can start.",
  "All-to-all #1 transposes the sharded axis: device d keeps head column h_d, ships its other three columns away (×3 — K and V travel with Q), and receives that same column from everyone else — [A, S/P, H] → [A/P, S, H]. The band flips to a full column: all tokens, one head group. Ringed cells just arrived.",
  "Device d now holds every one of the S = 8 tokens for its head group, so it runs ordinary full-sequence attention entirely locally — zero communication — producing O [A/P, S, H]: the same column footprint, one output cell per token.",
  "All-to-all #2 transposes back — [A/P, S, H] → [A, S/P, H]. Device d keeps the head column it computed for its own two tokens and collects their other three head columns from the devices that computed them (rings). The column flips back to the original band. Only O makes the return trip — a third of the outbound bytes, since Q, K and V collapse into a single output tensor.",
  "Read the band's four head columns as concatenated heads [S/P, A·H] and apply the replicated output projection: O @ W_o = Y [S/P, E] — the exact sequence-sharded shape X arrived in. The dense layers carry on as plain data parallelism.",
];

function slotsFor(step, d) {
  const C = CHIP_COLORS;
  const bandFill = (r) => ({ fill: owner(r) === d ? C[d] : ABSENT });

  switch (step) {
    case 0:
      return [
        { key: 'x', type: 'grid', name: 'X', sub: '[S/P, E]', rows: S, cols: E, fill: bandFill },
        { key: 'op1', type: 'op', sym: '@' },
        { key: 'wqkv', type: 'grid', name: 'W_qkv', sub: '[E, A·H] ×3', rows: E, cols: A, fill: () => ({ fill: YELLOW }) },
        { key: 'op2', type: 'op', sym: '=' },
        { key: 'qkv', type: 'grid', name: 'Q,K,V', sub: 'not yet computed', rows: S, cols: A, fill: () => ({ fill: ABSENT }) },
      ];
    case 1:
      return [
        { key: 'x', type: 'grid', name: 'X', sub: '[S/P, E]', rows: S, cols: E, fill: bandFill },
        { key: 'op1', type: 'op', sym: '@' },
        { key: 'wqkv', type: 'grid', name: 'W_qkv', sub: '[E, A·H] ×3', rows: E, cols: A, fill: () => ({ fill: YELLOW }) },
        { key: 'op2', type: 'op', sym: '=' },
        { key: 'qkv', type: 'grid', name: 'Q,K,V', sub: '[S/P, A·H]', rows: S, cols: A, fill: bandFill, frame: COMPUTE },
      ];
    case 2:
      return [
        {
          key: 'qkv',
          type: 'grid',
          name: 'Q,K,V',
          sub: `[A/P, S, H] · head h${d}`,
          rows: S,
          cols: A,
          fill: (r, c) => (c === d ? { fill: C[owner(r)], highlight: owner(r) !== d && A2A } : { fill: ABSENT }),
        },
      ];
    case 3:
      return [
        {
          key: 'qkv',
          type: 'grid',
          name: 'Q,K,V',
          sub: `[A/P, S, H] · head h${d}`,
          rows: S,
          cols: A,
          fill: (r, c) => (c === d ? { fill: C[owner(r)] } : { fill: ABSENT }),
        },
        { key: 'op1', type: 'op', sym: '→' },
        {
          key: 'o',
          type: 'grid',
          name: 'O',
          sub: '[A/P, S, H]',
          rows: S,
          cols: A,
          fill: (r, c) => (c === d ? { fill: C[owner(r)] } : { fill: ABSENT }),
          frame: COMPUTE,
        },
      ];
    case 4:
      return [
        {
          key: 'o',
          type: 'grid',
          name: 'O',
          sub: '[A, S/P, H]',
          rows: S,
          cols: A,
          fill: (r, c) => (owner(r) === d ? { fill: C[d], highlight: c !== d && A2A } : { fill: ABSENT }),
        },
      ];
    default:
      return [
        { key: 'o', type: 'grid', name: 'O', sub: '[S/P, A·H]', rows: S, cols: A, fill: bandFill },
        { key: 'op1', type: 'op', sym: '@' },
        { key: 'wo', type: 'grid', name: 'W_o', sub: '[A·H, E]', rows: A, cols: E, fill: () => ({ fill: YELLOW }) },
        { key: 'op2', type: 'op', sym: '=' },
        { key: 'y', type: 'grid', name: 'Y', sub: '[S/P, E]', rows: S, cols: E, fill: bandFill, frame: COMPUTE },
      ];
  }
}

function DevicePanel({ d, step }) {
  const slots = slotsFor(step, d);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '10px 10px',
        borderRadius: 12,
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: CHIP_COLORS[d], fontWeight: 700 }}>
        Device {d}
      </div>
      <div style={{ width: CONTENT_W, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', gap: 3 }}>
        {slots.map((slot) =>
          slot.type === 'op' ? (
            <OpSymbol key={slot.key} containerHeight={GRID_H}>
              {slot.sym}
            </OpSymbol>
          ) : (
            <TensorGrid
              key={slot.key}
              name={slot.name}
              subtitle={slot.sub}
              rows={slot.rows}
              cols={slot.cols}
              getFill={slot.fill}
              containerHeight={GRID_H}
              cellSize={CELL}
              frame={slot.frame}
            />
          )
        )}
      </div>
    </div>
  );
}

export default function UlyssesAttention() {
  const [step, setStep] = useState(0);
  const phase = PHASES[step];

  return (
    <WidgetShell
      title="Ulysses attention — two all-to-alls swap seq ↔ head sharding"
      subtitle="Four devices, S = 8 tokens, A = 4 heads. Every card draws the full logical tensor: rows are tokens, colored by the device that owns them; Q,K,V and O columns are heads; pale cells live on another device. Watch device d's slice flip from a row band (my tokens, all heads) to a column (all tokens, my head group) and back. Shape labels name each device's resident shard — batch dim B and head dim H are never drawn, so every Q,K,V/O cell is just one head's H-vector; this is Ulysses's maximal-sharding case P = A, one head per device, the most devices it allows."
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: phase.accent,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            minHeight: 16,
          }}
        >
          {phase.label}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 460, margin: '0 auto' }}>
        {Array.from({ length: P }, (_, d) => (
          <DevicePanel key={d} d={d} step={step} />
        ))}
      </div>

      <Legend
        items={[
          { fill: CHIP_COLORS[0], label: "device 0's tokens" },
          { fill: CHIP_COLORS[1], label: 'device 1' },
          { fill: CHIP_COLORS[2], label: 'device 2' },
          { fill: CHIP_COLORS[3], label: 'device 3' },
          { fill: YELLOW, label: 'replicated weight' },
          { fill: ABSENT, label: 'elsewhere' },
          { fill: CHIP_COLORS[0], ring: A2A, label: 'moved by all-to-all' },
        ]}
      />

      <Caption>{CAPTIONS[step]}</Caption>
      <StepControls step={step} totalSteps={TOTAL_STEPS} setStep={setStep} />
    </WidgetShell>
  );
}
