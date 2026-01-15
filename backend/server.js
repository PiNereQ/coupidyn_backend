import 'dotenv/config';

import express from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import usersRouter from './src/routes/users.js';
import couponsRouter from './src/routes/coupons.js';
import shopsRouter from './src/routes/shops.js';
import categoryRouter from './src/routes/categories.js';
import chatRouter from './src/routes/chat.js';
import ratingRouter from './src/routes/ratings.js';
import reportRouter from './src/routes/reports.js';
import eventsRouter from './src/routes/events.js';
import walletRouter from './src/routes/wallet.js';

import { initializeScheduler, initializeExpiryReminderScheduler } from './src/utils/scheduler.js';
import { initializeRecommendationScheduler, RecomOnce } from './src/utils/scheduleRecomendations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const HTTP_PORT = 8000;
const HTTPS_PORT = 8443;

// SSL Certificate paths
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || path.join(__dirname, '../ssl/privkey.pem');
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || path.join(__dirname, '../ssl/fullchain.pem');

app.use(express.json());
app.use('/users', usersRouter);
app.use('/coupons', couponsRouter);
app.use('/shops', shopsRouter);
app.use('/categories', categoryRouter);
app.use('/chat', chatRouter);
app.use('/payments', (await import('./src/services/paymentIntent.js')).default);
app.use('/ratings', ratingRouter);
app.use('/reports', reportRouter);
app.use('/events', eventsRouter);
app.use('/wallet', walletRouter);

app.get('/', (req, res) => {
  console.log('Check endpoint called');
  res.json({ message: 'Backend działa poprawnie' });
});

// Initialize scheduler
initializeScheduler();
initializeExpiryReminderScheduler();
initializeRecommendationScheduler();
RecomOnce();

// Check if SSL certificates exist
let server;
let httpsServer;

const sslExists = fs.existsSync(SSL_KEY_PATH) && fs.existsSync(SSL_CERT_PATH);

if (sslExists) {
  // SSL certificates found - start HTTPS server
  const sslOptions = {
    key: fs.readFileSync(SSL_KEY_PATH),
    cert: fs.readFileSync(SSL_CERT_PATH)
  };

  httpsServer = https.createServer(sslOptions, app);
  httpsServer.listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`🔒 HTTPS Server running on port ${HTTPS_PORT}`);
  });

  // HTTP server that redirects to HTTPS
  const httpApp = express();
  httpApp.use((req, res) => {
    const httpsUrl = `https://${req.hostname}:${HTTPS_PORT}${req.url}`;
    res.redirect(301, httpsUrl);
  });
  server = http.createServer(httpApp);
  server.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`🔀 HTTP Server running on port ${HTTP_PORT} (redirects to HTTPS)`);
  });
} else {
  // No SSL certificates - start HTTP only
  console.log('⚠️  SSL certificates not found. Starting HTTP server only.');
  console.log(`   Place certificates at: ${SSL_KEY_PATH} and ${SSL_CERT_PATH}`);
  server = app.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`Server działa na porcie ${HTTP_PORT}`);
  });
}

// Graceful error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Graceful shutdown
  const closeServers = () => {
    if (httpsServer) httpsServer.close();
    server.close(() => {
      console.log('Server shutdown due to uncaught exception');
      process.exit(1);
    });
  };
  closeServers();
});

// Graceful shutdown on SIGTERM
process.on('SIGTERM', () => {
  console.log('📌 SIGTERM received, shutting down gracefully...');
  const closeServers = () => {
    if (httpsServer) httpsServer.close();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  };
  closeServers();
});
