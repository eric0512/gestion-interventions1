import React, {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Error Boundary global pour capturer les crashes de rendu React
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: React.ErrorInfo | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });
    console.error("ERREUR CRITIQUE REACT:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return React.createElement('div', {
        style: {
          minHeight: '100vh',
          background: '#0D1B2A',
          color: 'white',
          padding: '24px',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center' as const,
        }
      },
        React.createElement('div', {
          style: {
            maxWidth: '400px',
            width: '100%',
          }
        },
          React.createElement('h1', {
            style: { fontSize: '24px', fontWeight: 'bold', color: '#daa520', marginBottom: '16px' }
          }, '⚠️ Erreur Application'),
          React.createElement('p', {
            style: { fontSize: '14px', color: '#94a3b8', marginBottom: '24px' }
          }, "L'application a rencontré une erreur. Voici les détails :"),
          React.createElement('div', {
            style: {
              background: '#1B263B',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
              textAlign: 'left' as const,
              maxHeight: '200px',
              overflow: 'auto',
              fontSize: '11px',
              color: '#f87171',
              wordBreak: 'break-all' as const,
            }
          }, 
            this.state.error?.message || 'Erreur inconnue',
            React.createElement('br'),
            React.createElement('br'),
            React.createElement('span', { style: { color: '#64748b', fontSize: '10px' } },
              this.state.error?.stack?.slice(0, 500) || ''
            )
          ),
          React.createElement('button', {
            onClick: () => {
              try {
                sessionStorage.clear();
                localStorage.removeItem('interventions');
              } catch(e) { /* ignore */ }
              window.location.reload();
            },
            style: {
              width: '100%',
              padding: '14px',
              background: '#daa520',
              color: '#000',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginBottom: '12px',
            }
          }, '🔄 Réinitialiser et recharger'),
          React.createElement('button', {
            onClick: () => {
              window.location.reload();
            },
            style: {
              width: '100%',
              padding: '14px',
              background: '#334155',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
            }
          }, '🔃 Recharger simplement')
        )
      );
    }

    return this.props.children;
  }
}

// Gestionnaire global des erreurs non capturées par React
window.addEventListener('error', (event) => {
  console.error('ERREUR GLOBALE:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('PROMESSE REJETÉE:', event.reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
