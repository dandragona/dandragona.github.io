import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const GrowthRateVisualizer = () => {
  const [p, setP] = useState(0.6);
  const [b, setB] = useState(1);

  const kellyFraction = useMemo(() => (p * b - (1 - p)) / b, [p, b]);

  const g = (f) => {
    if (f < 0 || f > 1) return -Infinity;
    const val = p * Math.log(1 + b * f) + (1 - p) * Math.log(1 - f);
    return isNaN(val) || !isFinite(val) ? -Infinity : val;
  };

  const data = useMemo(() => {
    const labels = [];
    const gDataPoints = [];
    const kDataPoints = [];
    for (let i = 0; i <= 100; i++) {
      const f = i / 100;
      labels.push(f.toFixed(2));
      const gVal = g(f);
      gDataPoints.push(gVal);
      kDataPoints.push(gVal > -Infinity ? Math.exp(gVal) : null);
    }
    return {
      labels,
      datasets: [
        {
          label: 'Logarithmic Growth Rate G(f)',
          data: gDataPoints,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
          yAxisID: 'y',
        },
        {
          label: 'Growth Factor K(f)',
          data: kDataPoints,
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1,
          yAxisID: 'y1',
        },
      ],
    };
  }, [p, b]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Growth Rate vs. Fraction of Bankroll Bet',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Fraction of Bankroll (f)',
        },
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        title: {
          display: true,
          text: 'Logarithmic Growth Rate G(f)',
        },
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        title: {
          display: true,
          text: 'Growth Factor K(f)',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
    },
  };

  return (
    <div>
      <div>
        <label>
          Probability of Winning (p): {p.toFixed(2)}
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={p}
            onChange={(e) => setP(parseFloat(e.target.value))}
          />
        </label>
      </div>
      <div>
        <label>
          Odds (b): {b.toFixed(2)}
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={b}
            onChange={(e) => setB(parseFloat(e.target.value))}
          />
        </label>
      </div>
      <div>
        <p>Kelly Fraction: {kellyFraction > 0 && kellyFraction < 1 ? kellyFraction.toFixed(3) : 'N/A'}</p>
        <p>Max Log Growth Rate (G): {g(kellyFraction) > -Infinity ? g(kellyFraction).toFixed(3) : 'N/A'}</p>
        <p>Max Growth Factor (K): {g(kellyFraction) > -Infinity ? Math.exp(g(kellyFraction)).toFixed(3) : 'N/A'}</p>
      </div>
      <div style={{ height: '400px' }}><Line options={options} data={data} /></div>
    </div>
  );
};

export default GrowthRateVisualizer;
