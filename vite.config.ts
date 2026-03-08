import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // On détecte si on est dans l'environnement Vercel
    const isVercel = process.env.VERCEL === '1' || mode === 'production' && !process.env.GITHUB_ACTIONS;

    return {
      // MODIFICATION : Choix dynamique du chemin de base
      // Si Vercel : '/' | Si GitHub Pages : '/yamehome-v2-test/'
      base: isVercel ? '/' : '/yamehome-v2-test/',
      
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});