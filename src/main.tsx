import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';

// Automatic reload if a new version deployment changes chunk asset filenames
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  const lastReload = Number(sessionStorage.getItem('bjl_last_preload_reload') || '0');
  const now = Date.now();
  if (now - lastReload > 15000) {
    sessionStorage.setItem('bjl_last_preload_reload', String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
