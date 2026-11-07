import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('Error capturado por ErrorBoundary:', error, errorInfo);
    }
  }
  
  handleReset = () => {
    // Clear the error state and force a re-render
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: 20, 
          color: '#b91c1c', 
          background: '#fef2f2', 
          border: '1px solid #fecaca', 
          borderRadius: 8, 
          margin: 20,
          textAlign: 'center'
        }}>
          <h2 style={{ color: '#b91c1c', marginBottom: 10 }}>Error en la aplicación</h2>
          <p style={{ marginBottom: 12, fontSize: 14 }}>Ha ocurrido un error al cargar esta página.</p>
          <p style={{ fontSize: 12, marginBottom: 16, color: '#6b7280', wordBreak: 'break-word' }}>
            <strong>Detalle:</strong> {this.state.error?.message || 'Error desconocido'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={this.handleReset} 
              style={{ 
                padding: '8px 16px', 
                background: '#0f766e', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Intentar de nuevo
            </button>
            <button 
              onClick={() => window.location.reload()} 
              style={{ 
                padding: '8px 16px', 
                background: '#6b7280', 
                color: '#fff', 
                border: 'none', 
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              Recargar página
            </button>
          </div>
          <details style={{ marginTop: 20, textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>Ver detalles del error</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 10, background: '#f9fafb', padding: 10, borderRadius: 4, marginTop: 8 }}>
{this.state.error?.stack}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}