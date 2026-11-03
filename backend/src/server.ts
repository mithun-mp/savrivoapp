import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './database/connection';
import { sanitizeErrorMessage } from './utils/sanitize';
import { config } from './config/env';

async function start() {
  try {
    // Connect to database before accepting incoming HTTP requests
    await connectDatabase();

    const app = createApp();
    const server = app.listen(config.port, () => {
      console.log(`[Server] SAVRIVO API running on port ${config.port} (${config.nodeEnv})`);
      console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
    });

    let isShuttingDown = false;
    const graceful = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`[Server] Received ${signal}. Shutting down gracefully...`);

      // Set force timeout in case keep-alive connections hang
      const forceTimer = setTimeout(() => {
        console.error('[Server] Graceful shutdown timed out after 10s. Force exiting.');
        process.exit(1);
      }, 10000);
      forceTimer.unref();

      server.close(async () => {
        console.log('[Server] HTTP server closed.');
        await disconnectDatabase();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => graceful('SIGTERM'));
    process.on('SIGINT', () => graceful('SIGINT'));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Server] Fatal startup error:', sanitizeErrorMessage(message));
    process.exit(1);
  }
}

start();