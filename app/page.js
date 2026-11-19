'use client';

import { useEffect, useRef, useState } from 'react';
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
    if (!url) return;
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

const LIVE_WINDOW_MS = 6 * 3600e3;

function useLiveReadings(every) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const lastRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const url = lastRef.current
          ? '/api/readings?since=' + encodeURIComponent(lastRef.current)
          : '/api/readings?hours=6';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        let rows = await res.json();

        // Nothing in the last 6 hours: fall back to the most recent readings
        if (!lastRef.current && rows.length === 0) {
          const res2 = await fetch('/api/readings?limit=200', { cache: 'no-store' });
          if (res2.ok) rows = await res2.json();
        }

        if (!active) return;
        if (rows.length) lastRef.current = rows[rows.length - 1].receivedAt;
        setData((prev) => {
          const all = prev.concat(rows);
          if (!all.length) return all;
          // Window is measured back from the newest reading, not from "now"
          const newest = new Date(all[all.length - 1].receivedAt).getTime();
          return all.filter((r) => new Date(r.receivedAt).getTime() >= newest - LIVE_WINDOW_MS);
        });
        setError(null);
      } catch (e) {
        if (active) setError(e.message);
      }
    }
    load();
    const id = setInterval(load, every);
    return () => { active = false; clearInterval(id); };
  }, [every]);

  return { data, error };
}

export default function Home() {
  const [view, setView] = useState('live');
  const cfg = VIEWS[view];

  const liveFeed = useLiveReadings(VIEWS.live.every);
  const rangeFeed = usePolling(view === 'live' ? null : cfg.url, cfg.every);
  const feed = view === 'live' ? liveFeed : rangeFeed;

  const latest = liveFeed.data[liveFeed.data.length - 1];
  const error = liveFeed.error || rangeFeed.error;

  const fmt = (t) => {
    const d = new Date(t);
    return view === 'live' || view === 'day'
      ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric' });
  };

  const chartData = feed.data.map((r) => ({
    ...r,
    ts: new Date(r.receivedAt).getTime(),
  }));

  return (
    <main style={{ maxWidth: 1300, margin: '0 auto', padding: 14, fontFamily: 'var(--font-body)' }}>
      <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 44, margin: '24px 0 0' }}><b>Sinton Power Line Monitor</b></h1>

      {error && <p style={{ color: 'crimson' }}>Could not load data: {error}</p>}
      {latest && (
        <p style={{ color: '#666' }}>
          Last reading: {new Date(latest.receivedAt).toLocaleString()}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ border: '2px solid #ccc', borderRadius: 8, padding: 12, minWidth: 150 }}>
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
              border: '2px solid #888',
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
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, margin: '0 0 5px' }}>
            <b>{f.label}</b>{f.unit && ` (${f.unit})`}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15}/>
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={fmt}
                minTickGap={40}
                stroke="currentColor"
                axisLine={{ strokeWidth: 2 }}
                tickLine={{ strokeWidth: 2 }}
              />
            <YAxis
                domain={
                  f.band
                    ? [(min) => Math.min(min, f.band[0]), (max) => Math.max(max, f.band[1])]
                    : ['auto', 'auto']
                }
                tickFormatter={(v) => Number(v.toFixed(2))}
                stroke="currentColor"
                axisLine={{ strokeWidth: 2 }}
                tickLine={{ strokeWidth: 2 }}
                tick={{ dy: -5 }}
              />
              <Tooltip
                shared={false}
                cursor={false}
                labelFormatter={fmt}
                labelStyle={{ color: '#000' }}
                separator=""
                formatter={(value) => [value, null]}
              />
              {f.nominal && <ReferenceLine y={f.nominal} stroke="#999" strokeDasharray="4 4" />}
              <Line
                type="monotone"
                dataKey={f.key}
                dot={{ r: 3 }}
                activeDot={{ r: 6 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </main>
  );
}