'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { FIELDS } from '@/lib/fields';

const VIEWS = {
  live: { label: 'Live', url: '/api/readings?limit=200', every: 3000 },
  day: { label: 'Day', url: '/api/readings?range=day', every: 60000 },
  week: { label: 'Week', url: '/api/readings?range=week', every: 300000 },
  month: { label: 'Month', url: '/api/readings?range=month', every: 300000 },
};

function usePolling(url, every) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        if (active) { setData(json); setError(null); }
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    load();
    const id = setInterval(load, every);
    return () => { active = false; clearInterval(id); };
  }, [url, every]);

  return { data, error };
}

export default function Home() {
  const [view, setView] = useState('live');
  const cfg = VIEWS[view];

  const liveFeed = usePolling(VIEWS.live.url, VIEWS.live.every);
  const chartFeed = usePolling(cfg.url, cfg.every);

  const latest = liveFeed.data[liveFeed.data.length - 1];
  const error = liveFeed.error || chartFeed.error;

  const chartData = chartFeed.data.map((r) => {
    const d = new Date(r.receivedAt);
    return {
      ...r,
      time:
        view === 'live' || view === 'day'
          ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
          : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric' }),
    };
  });

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 16, fontFamily: 'var(--font-body)' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)' }}>Sensor Dashboard</h1>

      {error && <p style={{ color: 'crimson' }}>Could not load data: {error}</p>}
      {latest && (
        <p style={{ color: '#666' }}>
          Last reading: {new Date(latest.receivedAt).toLocaleString()}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, minWidth: 150 }}>
            <div style={{ color: '#666', fontSize: 14 }}>{f.label}</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
              {latest && latest[f.key] !== undefined ? latest[f.key] : '—'} {f.unit}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {Object.entries(VIEWS).map(([key, v]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: '1px solid #888',
              cursor: 'pointer',
              fontFamily: 'var(--font-body)',
              background: key === view ? '#222' : 'transparent',
              color: key === view ? '#fff' : 'inherit',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {FIELDS.map((f) => (
        <div key={f.key} style={{ marginBottom: 32 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)' }}>
            {f.label}{f.unit && ` (${f.unit})`}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" minTickGap={40} />
              <YAxis
                domain={
                  f.band
                    ? [(min) => Math.min(min, f.band[0]), (max) => Math.max(max, f.band[1])]
                    : ['auto', 'auto']
                }
                tickFormatter={(v) => Number(v.toFixed(2))}
              />
              <Tooltip />
              {f.nominal && <ReferenceLine y={f.nominal} stroke="#999" strokeDasharray="4 4" />}
              <Line type="monotone" dataKey={f.key} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </main>
  );
}