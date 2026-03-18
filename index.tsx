import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// --- GESTION DU SERVICE WORKER POUR LE MODE HORS-LIGNE (MOBILE DATA FIX) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    /**
     * TRÈS IMPORTANT POUR GITHUB PAGES :
     * On utilise './service-worker.ts' (avec un point) pour que le chemin soit relatif.
     * On ajoute '{ scope: "./" }' pour que le téléphone accepte de contrôler tout le dossier.
     */
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then((registration) => {
        console.log('ServiceWorker activé avec succès ! Scope: ', registration.scope);
        
        // Logique pour détecter une mise à jour et forcer le rafraîchissement
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Nouvelle version disponible, veuillez rafraîchir la page.');
              }
            };
          }
        };
      })
      .catch((err) => {
        console.error('Erreur lors de l’enregistrement du Service Worker : ', err);
      });
  });
}