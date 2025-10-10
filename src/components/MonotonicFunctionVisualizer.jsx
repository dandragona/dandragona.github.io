import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const MonotonicFunctionVisualizer = () => {
  const [n, setN] = useState(1);

  const baseFunction = (x) => 4 - (1/2 * Math.pow(x-2 , 2));
  const logFunction = (x) => Math.log(x);
  const transformedFunction = (x) => Math.log(baseFunction(x));

  const data = useMemo(() => {
    const labels = [];
    const baseData = [];
    const logData = [];
    const transformedData = [];
    for (let i = 1; i <= 40; i++) {
      const x = i / 10;
      labels.push(x.toFixed(1));
      baseData.push(baseFunction(x));
      logData.push(logFunction(x));
      const transformedValue = transformedFunction(x);
      transformedData.push(isNaN(transformedValue) || !isFinite(transformedValue) ? null : transformedValue);
    }
    return {
      labels,
      datasets: [
        {
          label: `f(x) = 4 - 1/2(x-2)^2`,
          data: baseData,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1,
        },
        {
          label: `log(x)`,
          data: logData,
          borderColor: 'rgb(153, 102, 255)',
          tension: 0.1,
        },
        {
          label: `log(f(x))`,
          data: transformedData,
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1,
        },
      ],
    };
  }, [n]);

  const options = {
    responsive: true,
    animation: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 16,
          },
        },
      },
      title: {
        display: true,
        text: 'Applying a Monotonic Function',
        font: {
          size: 20,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'x',
          font: {
            size: 16,
          },
        },
        ticks: {
          font: {
            size: 14,
          },
        },
      },
      y: {
        title: {
          display: true,
          text: 'y',
          font: {
            size: 16,
          },
        },
        ticks: {
          font: {
            size: 14,
          },
        },
      },
    },
  };

  return (
    <div>
      <Line options={options} data={data} updateMode="none" />
    </div>
  );
};

export default MonotonicFunctionVisualizer;
