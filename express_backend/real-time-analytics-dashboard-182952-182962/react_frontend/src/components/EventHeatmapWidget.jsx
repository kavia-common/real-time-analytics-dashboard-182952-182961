import React, { useEffect, useMemo, useState } from 'react';
import io from 'socket.io-client';

/**
 * PUBLIC_INTERFACE
 * EventHeatmapWidget
 * Renders a 24x7 heatmap (hours x days) using data from /api/metrics/event-heatmap.
 * - Query param range: '24h' | '7d' (default '7d'), selectable via UI
 * - Uses Ocean Professional palette
 * - Includes accessible labels, legends, tooltips, and loading/empty/error states
 * - Auto-refreshes on 'metrics_update', 'new_answer', and 'user_event_created' Socket.io events
 */
export default function EventHeatmapWidget({ apiBase = '' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('7d');
  const [buckets, setBuckets] = useState([]);
  const [timezone, setTimezone] = useState('UTC');

  const fetchData = async (r = range) => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${apiBase}/api/metrics/event-heatmap?range=${encodeURIComponent(r)}`);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const json = await res.json();
      setTimezone(typeof json.timezone === 'string' ? json.timezone : 'UTC');
      setBuckets(Array.isArray(json.buckets) ? json.buckets : []);
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(range);
    const socket = io('/', { withCredentials: true });
    const handler = () => fetchData(range);
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
  }, [apiBase, range]);

  // Build a 7 rows (Sun..Sat), 24 cols (0..23) matrix
  const matrix = useMemo(() => {
    const m = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (const b of buckets) {
      const h = Number(b.hour);
      const d = Number(b.dow);
      const c = Number(b.count) || 0;
      if (d >= 0 && d < 7 && h >= 0 && h < 24) {
        m[d][h] = c;
      }
    }
    return m;
  }, [buckets]);

  const maxCount = useMemo(() => {
    let max = 0;
    for (const row of matrix) {
      for (const v of row) {
        if (v > max) max = v;
      }
    }
    return max;
  }, [matrix]);

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);

  // Ocean Professional palette steps (light to dark)
  const colors = ['#EFF6FF', '#DBEAFE', '#BFDBFE', '#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8'];
  const colorFor = (v) => {
    if (maxCount <= 0) return '#F3F4F6'; // neutral gray when no data
    const ratio = v / maxCount; // 0..1
    const idx = Math.min(colors.length - 1, Math.floor(ratio * (colors.length - 1)));
    return colors[idx];
  };

  return (
    <section
      aria-labelledby="event-heatmap-title"
      className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 flex flex-col gap-3"
      style={{ background: '#ffffff', color: '#111827' }}
    >
      <div className="flex items-center justify-between">
        <h3 id="event-heatmap-title" className="text-sm font-medium">
          Event Heatmap by Hour (UTC)
        </h3>
        <div className="flex items-center gap-2">
          <label htmlFor="heatmap-range" className="text-xs text-gray-600">
            Range
          </label>
          <select
            id="heatmap-range"
            aria-label="Select time range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="text-xs px-2 py-1 rounded border border-gray-200"
            style={{ background: '#ffffff', color: '#111827' }}
          >
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
          </select>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: '#EFF6FF', color: '#2563EB' }}
          >
            {timezone}
          </span>
        </div>
      </div>

      {loading ? (
        <div role="status" aria-live="polite" className="text-gray-500 text-sm">
          Loading heatmap...
        </div>
      ) : error ? (
        <div role="alert" className="text-red-600 text-sm">
          {error}
        </div>
      ) : maxCount === 0 ? (
        <div role="img" aria-label="No event activity in selected range" className="text-gray-500 text-sm">
          No activity in the selected range
        </div>
      ) : (
        <>
          {/* X-axis hours */}
          <div className="overflow-auto">
            <div
              role="img"
              aria-label="Heatmap showing counts of events by hour of day and day of week, UTC"
              style={{ minWidth: 640 }}
            >
              <div className="grid" style={{ gridTemplateColumns: '72px repeat(24, 1fr)', gap: 2 }}>
                <div />
                {hourLabels.map((h) => (
                  <div key={h} className="text-[10px] text-gray-600 text-center">
                    {h}
                  </div>
                ))}
                {matrix.map((row, d) => (
                  <React.Fragment key={d}>
                    <div className="text-xs text-gray-700 pr-2 flex items-center justify-end">{dayLabels[d]}</div>
                    {row.map((v, h) => (
                      <div
                        key={`${d}-${h}`}
                        title={`${dayLabels[d]} @ ${hourLabels[h]} — ${v} events`}
                        aria-label={`${dayLabels[d]} at ${hourLabels[h]} has ${v} events`}
                        style={{
                          background: colorFor(v),
                          height: 18,
                          borderRadius: 3,
                          border: '1px solid rgba(17,24,39,0.06)',
                        }}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-600">Less</span>
            <div className="flex items-center gap-1">
              {colors.map((c, i) => (
                <span key={i} style={{ width: 18, height: 10, background: c, borderRadius: 2, border: '1px solid rgba(17,24,39,0.06)' }} />
              ))}
            </div>
            <span className="text-xs text-gray-600">More</span>
            <span className="text-xs text-gray-400 ml-auto">
              Max: {maxCount}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
