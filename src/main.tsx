import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.tsx'
import { AuthProfileProvider } from './contexts/AuthProfileContext.tsx'

// ── Sentry (erro em produção) ─────────────────────────────────────────────────
// Inicializa apenas se VITE_SENTRY_DSN estiver configurado — sem DSN, silencioso.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,          // 'development' | 'production'
    tracesSampleRate: 0.1,                       // 10% de traces de performance
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
          background: '#FAFAF8', color: '#1A1D1C', fontFamily: 'Inter, sans-serif',
        }}>
          <img src="/brand/auri-logo-full.svg" alt="Auri" style={{ height: 44 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <p style={{ fontSize: 15, color: '#6B7280', margin: 0 }}>
            Ocorreu um erro inesperado. Recarregue a página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#0F4C5C', color: '#fff', fontSize: 14,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Recarregar
          </button>
        </div>
      }
    >
      <AuthProfileProvider>
        <App />
        <Toaster position="bottom-right" richColors closeButton duration={4000} />
      </AuthProfileProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
