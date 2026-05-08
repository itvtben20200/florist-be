import 'dotenv/config';
import { config } from './config';
import app from './app';
import { connectRedis } from './lib/redis';
import { startWorkers } from './workers/crm.worker';

const start = async () => {
  await connectRedis(); // non-fatal — server starts even if Redis is down
  startWorkers();

  app.listen(config.port, () => {
    console.log(`[server] Running on port ${config.port} (${config.nodeEnv})`);
  });
};

start().catch((err) => {
  console.error('[server] Failed to start:', err);
  process.exit(1);
});
