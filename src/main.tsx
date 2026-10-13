import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
// Inline so Tailwind applies even when the separate CSS link 404s / is CORS-blocked in the CMS iframe.
import appCss from './index.css?inline';

(() => {
  if (document.querySelector('style[data-opennext-crm-css]')) return;
  const el = document.createElement('style');
  el.setAttribute('data-opennext-crm-css', '');
  el.textContent = appCss;
  document.head.appendChild(el);
})();

// Ensure proper initial hash is set before React renders if opened directly or reloaded
try {
  const currentHash = window.location.hash.replace(/^#\/?/, '').split('?')[0].trim();
  if (!currentHash) {
    const params = new URLSearchParams(window.location.search);
    const cmsPage = params.get('__cms_page');
    if (cmsPage) {
      window.location.hash = `#/${cmsPage}`;
    } else if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
      const parentUrl = new URL(window.parent.location.href);
      const runtimePath = '/dashboard/plugins/runtime/openext-crm-suite';
      if (parentUrl.pathname.startsWith(runtimePath)) {
        const suffix = parentUrl.pathname.slice(runtimePath.length).replace(/^\/+/, '');
        const navId = suffix.split('/').filter(Boolean)[0];
        if (navId) {
          window.location.hash = `#/${decodeURIComponent(navId)}`;
        }
      }
    }
  }
} catch {
  // Graceful fallback
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find root element in DOM');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
