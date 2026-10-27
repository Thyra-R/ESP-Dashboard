'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';

// To add a sensor later, add one line here.
const FIELDS = [
  { key: 'vrms', label: 'Vrms', unit: 'V' },
  { key: 'impedance', label: 'Impedance', unit: 'Ω' },
  { key: 'frequency', label: 'Frequency', unit: 'Hz' },
  { key: 'noise', label: 'Noise', unit: '' },
];

const POLL_MS = 3000;

export default function Home() {
  const [readings, setReadings] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch('/api/readings?limit=200', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (active) {
          setReadings(data.reverse()); // API returns newest first; charts want oldest first
          setError(null);
        }
      } catch (e) {
        if (active) setError(e.message);
      }
    }

    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const chartData = readings.map((r) => ({
    ...r,
    time: new Date(r.receivedAt).toLocaleTimeString(),
  }));
  const latest = readings[readings.length - 1];

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: 16, fontFamily: 'sans-serif' }}>
      <h1>Sensor Dashboard</h1>

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
            <div style={{ fontSize: 28, fontWeight: 'bold' }}>
              {latest && latest[f.key] !== undefined ? latest[f.key] : '—'} {f.unit}
            </div>
          </div>
        ))}
      </div>

      {FIELDS.map((f) => (
        <div key={f.key} style={{ marginBottom: 32 }}>
          <h3>{f.label}{f.unit && ` (${f.unit})`}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" minTickGap={40} />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Line type="monotone" dataKey={f.key} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </main>
  );
}