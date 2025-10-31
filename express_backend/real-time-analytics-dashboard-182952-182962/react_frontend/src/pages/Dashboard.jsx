import React from 'react';
import UsersAnsweredTodayWidget from '../components/UsersAnsweredTodayWidget';

/**
 * PUBLIC_INTERFACE
 * Dashboard page integrating the UsersAnsweredTodayWidget component.
 * This ensures the widget is reachable from the app entry point.
 */
export default function Dashboard() {
  return (
    <main style={{ background: '#f9fafb', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111827', marginBottom: 12 }}>
          Analytics Dashboard
        </h1>
        <div
          style={{
            display: 'grid',
            gap: 12,
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          }}
        >
          <UsersAnsweredTodayWidget />
        </div>
      </div>
    </main>
  );
}
