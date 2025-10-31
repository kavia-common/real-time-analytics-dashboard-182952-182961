import React from 'react';
import ReactDOM from 'react-dom/client';
import Dashboard from './pages/Dashboard';

/**
 * PUBLIC_INTERFACE
 * App entry point rendering the Dashboard that includes the UsersAnsweredTodayWidget.
 */
function App() {
  return <Dashboard />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
