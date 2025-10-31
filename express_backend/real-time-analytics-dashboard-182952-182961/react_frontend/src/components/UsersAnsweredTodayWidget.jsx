import React, { useEffect, useMemo, useState } from 'react';
import io from 'socket.io-client';

/**
 * PUBLIC_INTERFACE
 * UsersAnsweredTodayWidget
 * This component renders a KPI tile for today's total unique answerers and a compact line chart
 * showing the per-minute trend for today. It refreshes automatically when a 'metrics_update',
 * 'new_answer', or 'user_event_created' Socket.io event is received.
 */
export default function UsersAnsweredTodayWidget({ apiBase = '' }) {
  /**
   * Props:
   *  - apiBase: optional base URL for API (e.g., ''). The component will request `${apiBase}/api/metrics/users-answered-today`.
   */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({ total: 0, series: [], timezone: 'UTC' });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${apiBase}/api/metrics/users-answered-today`);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const json = await res.json();
      // Validate shape
      const total = Number(json.total) || 0;
      const series = Array.isArray(json.series) ? json.series : [];
      const timezone = typeof json.timezone === 'string' ? json.timezone : 'UTC';
      setData({ total, series, timezone });
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Connect socket for live updates
    // Use same origin by default
    const socket = io('/', { withCredentials: true });
    const handler = () => fetchData();
    socket.on('metrics_update', handler);
    socket.on('new_answer', handler);
    socket.on('user_event_created', handler);
    return () => {
      socket.off('metrics_update', handler);
      socket.off('new_answer', handler);
      socket.off('user_event_created', handler);
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  const points = useMemo(() => {
    // Map data.series to numeric points for chart
    return (data.series || []).map((pt) => ({
      t: new Date(pt.time),
      v: Number(pt.value) || 0,
    }));
  }, [data.series]);

  // Simple inline SVG line chart (no external deps), Ocean Professional theme
  const Chart = () => {
    if (!points.length) {
      return (
        <div role="img" aria-label="No data to display" className="text-gray-500 text-sm">
          No trend data yet today
        </div>
      );
    }
    const width = 280;
    const height = 80;
    const padding = 8;

    const times = points.map((p) => p.t.getTime());
    const values = points.map((p) => p.v);
    const minX = Math.min(...times);
    const maxX = Math.max(...times);
    const minY = 0;
    const maxY = Math.max(1, ...values);

    const xScale = (t) => {
      if (maxX === minX) return padding;
      return padding + ((t - minX) / (maxX - minX)) * (width - padding * 2);
    };
    const yScale = (v) => {
      if (maxY === minY) return height - padding;
      // Invert y to draw upward
      return padding + (1 - (v - minY) / (maxY - minY)) * (height - padding * 2);
    };

    const pathD = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.t.getTime())} ${yScale(p.v)}`)
      .join(' ');

    // Area under the line for subtle depth
    const areaD =
      `M ${xScale(points[0].t.getTime())} ${yScale(points[0].v)} ` +
      points.slice(1).map((p) => `L ${xScale(p.t.getTime())} ${yScale(p.v)}`).join(' ') +
      ` L ${xScale(points[points.length - 1].t.getTime())} ${height - padding}` +
      ` L ${xScale(points[0].t.getTime())} ${height - padding} Z`;

    return (
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Minute-by-minute unique answerers trend for today"
      >
        <defs>
          <linearGradient id="oceanArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#oceanArea)" />
        <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="2" />
      </svg>
    );
  };

  return (
    <section
      aria-labelledby="users-answered-today-title"
      className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex flex-col gap-3"
      style={{
        background: '#ffffff',
        color: '#111827',
      }}
    >
      <div className="flex items-center justify-between">
        <h3 id="users-answered-today-title" className="text-sm font-medium">
          Users Answered Today
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: '#EFF6FF', color: '#2563EB' }}
        >
          {data.timezone}
        </span>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" className="text-gray-500 text-sm">
          Loading...
        </div>
      ) : error ? (
        <div role="alert" className="text-red-600 text-sm">
          {error}
        </div>
      ) : (
        <>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-semibold" style={{ color: '#2563EB' }}>
              {data.total}
            </div>
            <div className="text-xs text-gray-500">unique answerers</div>
          </div>
          <Chart />
        </>
      )}
    </section>
  );
}
