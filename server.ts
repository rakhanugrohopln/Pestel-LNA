import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express from 'express';
import { createApiRouter } from './server/routes.ts';
import { getSessionSecret } from './server/authMiddleware.ts';
import { getStore } from './server/store.ts';

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  // Required for Cloud Run / reverse proxy HTTPS cookie detection
  app.set('trust proxy', 1);

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // Ensure initial store and shared session signing key are initialized cleanly
  getStore();
  getSessionSecret();

  // Mount REST API
  app.use('/api', createApiRouter());

  const distDir = path.resolve(process.cwd(), 'dist');
  const isProdBuild = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(distDir, 'index.html'));

  if (!isProdBuild) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir, { index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`PLN CORPU Analytics server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
