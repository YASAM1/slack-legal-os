import { z } from 'zod';
import { registerPrimitive } from './registry';

// QuickChart.io is a hosted Chart.js renderer. We POST the chart config,
// get back a short, public PNG URL, and let Slack auto-unfurl it inline.
// No fonts, no native modules, no Blob storage required.
const QUICKCHART_CREATE = 'https://quickchart.io/chart/create';

const DataRowSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

const PALETTE = [
  '#2563eb',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

interface QuickChartResponse {
  success: boolean;
  url?: string;
  error?: string;
}

async function postChart(config: object): Promise<string> {
  const res = await fetch(QUICKCHART_CREATE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      version: '4',
      backgroundColor: 'white',
      width: 800,
      height: 500,
      devicePixelRatio: 2,
      format: 'png',
      chart: config,
    }),
  });
  if (!res.ok) {
    throw new Error(`QuickChart request failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as QuickChartResponse;
  if (!data.success || !data.url) {
    throw new Error(`QuickChart error: ${data.error ?? 'unknown'}`);
  }
  return data.url;
}

function projectRows(rows: Array<Record<string, unknown>>, field: string): unknown[] {
  return rows.map((r) => r[field]);
}

export const renderChart = registerPrimitive({
  name: 'chart.render',
  category: 'chart',
  description:
    'Render an arbitrary Chart.js v4 config to a public PNG URL via QuickChart. Use this for custom charts; prefer chart.bar / chart.line / chart.pie for common cases. After getting the URL, paste it in a slack.post call so Slack auto-unfurls it inline.',
  inputSchema: z.object({
    title: z.string().min(1),
    config: z.record(z.string(), z.unknown()).describe('A complete Chart.js config object with type, data, and options'),
  }),
  handler: async ({ title, config }) => {
    const url = await postChart(config);
    return { url, title };
  },
});

export const barChart = registerPrimitive({
  name: 'chart.bar',
  category: 'chart',
  description:
    'Render a bar chart from row data and return a public PNG URL. Bars are sorted descending by value with the count printed on top of each bar. After getting the URL, post it via slack.post — Slack will auto-unfurl as an inline image.',
  inputSchema: z.object({
    title: z.string().min(1),
    xField: z.string().describe('Row key for the category (string)'),
    yField: z.string().describe('Row key for the value (number)'),
    xTitle: z.string().optional(),
    yTitle: z.string().optional(),
    data: z.array(DataRowSchema).min(1),
  }),
  handler: async ({ title, xField, yField, xTitle, yTitle, data }) => {
    const sorted = [...data].sort((a, b) => Number(b[yField] ?? 0) - Number(a[yField] ?? 0));
    const labels = projectRows(sorted, xField);
    const values = projectRows(sorted, yField);

    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: yTitle ?? yField,
            data: values,
            backgroundColor: '#2563eb',
            borderRadius: 4,
          },
        ],
      },
      options: {
        plugins: {
          title: { display: true, text: title, font: { size: 18, weight: 'bold' } },
          legend: { display: false },
          datalabels: {
            anchor: 'end',
            align: 'top',
            color: '#404040',
            font: { weight: 'bold', size: 12 },
          },
        },
        scales: {
          x: { title: { display: !!xTitle, text: xTitle ?? '' }, ticks: { autoSkip: false } },
          y: { title: { display: !!yTitle, text: yTitle ?? '' }, beginAtZero: true },
        },
      },
    };

    const url = await postChart(config);
    return { url, title };
  },
});

export const lineChart = registerPrimitive({
  name: 'chart.line',
  category: 'chart',
  description:
    'Render a line chart from time-series row data. xField should be a label (date string OK). Supports optional `seriesField` for multi-line.',
  inputSchema: z.object({
    title: z.string().min(1),
    xField: z.string(),
    yField: z.string(),
    seriesField: z.string().optional(),
    xTitle: z.string().optional(),
    yTitle: z.string().optional(),
    data: z.array(DataRowSchema).min(1),
  }),
  handler: async ({ title, xField, yField, seriesField, xTitle, yTitle, data }) => {
    let datasets: Array<Record<string, unknown>>;
    let labels: unknown[];

    if (seriesField) {
      const xs = Array.from(new Set(data.map((r) => r[xField] as string)));
      labels = xs;
      const series = Array.from(new Set(data.map((r) => r[seriesField] as string)));
      datasets = series.map((s, i) => ({
        label: s,
        data: xs.map((x) => {
          const row = data.find((r) => r[xField] === x && r[seriesField] === s);
          return row ? row[yField] : null;
        }),
        borderColor: PALETTE[i % PALETTE.length],
        backgroundColor: PALETTE[i % PALETTE.length],
        tension: 0.2,
      }));
    } else {
      labels = projectRows(data, xField);
      datasets = [
        {
          label: yTitle ?? yField,
          data: projectRows(data, yField),
          borderColor: '#2563eb',
          backgroundColor: '#2563eb',
          tension: 0.2,
        },
      ];
    }

    const config = {
      type: 'line',
      data: { labels, datasets },
      options: {
        plugins: {
          title: { display: true, text: title, font: { size: 18, weight: 'bold' } },
          legend: { display: !!seriesField },
        },
        scales: {
          x: { title: { display: !!xTitle, text: xTitle ?? '' } },
          y: { title: { display: !!yTitle, text: yTitle ?? '' }, beginAtZero: true },
        },
      },
    };

    const url = await postChart(config);
    return { url, title };
  },
});

export const pieChart = registerPrimitive({
  name: 'chart.pie',
  category: 'chart',
  description: 'Render a pie chart from row data with a category and value field.',
  inputSchema: z.object({
    title: z.string().min(1),
    categoryField: z.string(),
    valueField: z.string(),
    data: z.array(DataRowSchema).min(1),
  }),
  handler: async ({ title, categoryField, valueField, data }) => {
    const labels = projectRows(data, categoryField);
    const values = projectRows(data, valueField);

    const config = {
      type: 'pie',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((_, i) => PALETTE[i % PALETTE.length]),
          },
        ],
      },
      options: {
        plugins: {
          title: { display: true, text: title, font: { size: 18, weight: 'bold' } },
          legend: { position: 'right' },
          datalabels: { color: 'white', font: { weight: 'bold' } },
        },
      },
    };

    const url = await postChart(config);
    return { url, title };
  },
});
