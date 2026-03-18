import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    // On détecte l'environnement de déploiement
    const isVercel = process.env.VERCEL === '1';

    return {
      // TRÈS IMPORTANT : Doit correspondre exactement au nom de ton dépôt GitHub
      base: isVercel ? '/' : '/yamehome_app/',
      
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
      },
      // --- OPTIMISATION POUR LE CACHE MOBILE ---
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
        sourcemap: false, // Plus léger à charger pour les petites connexions
        rollupOptions: {
          output: {
            // On s'assure que les noms de fichiers ne sont pas trop complexes
            chunkFileNames: 'assets/js/[name]-[hash].js',
            entryFileNames: 'assets/js/[name]-[hash].js',
            assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
          }
        }
      }
    };
});