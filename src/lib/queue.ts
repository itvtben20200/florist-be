import { Queue } from 'bullmq';
import { redis } from './redis';

export const CRM_QUEUE_NAME = 'crm-sync';

let crmQueue: Queue | null = null;

export const getCrmQueue = (): Queue | null => {
  if (!redis) return null;
  if (!crmQueue) {
    crmQueue = new Queue(CRM_QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return crmQueue;
};

export const enqueueCrmSync = async (orderId: string) => {
  const queue = getCrmQueue();
  if (!queue) {
    console.warn(`[queue] Redis unavailable — skipping CRM sync for order ${orderId}`);
    return;
  }
  await queue.add('sync-order', { orderId });
};
