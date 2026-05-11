import { Worker } from 'bullmq';
import { redis } from '../lib/redis';
import { CRM_QUEUE_NAME } from '../lib/queue';
import Redis from 'ioredis';
import { CrmService } from '../services/crm.service';
import { prisma } from '../lib/prisma';

const crmService = new CrmService();

export const startWorkers = () => {
  if (!redis) {
    console.warn('[crm-worker] Redis not available — worker not started');
    return null;
  }
  const worker = new Worker(
    CRM_QUEUE_NAME,
    async (job) => {
      const { orderId } = job.data as { orderId: string };

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
          items: { include: { product: true } },
          crmSyncLog: true,
        },
      });

      if (!order) throw new Error(`Order ${orderId} not found`);

      await prisma.crmSyncLog.upsert({
        where: { orderId },
        create: { orderId, crmName: process.env.CRM_PROVIDER || 'none', attempts: 1, lastAttemptAt: new Date() },
        update: { attempts: { increment: 1 }, lastAttemptAt: new Date(), status: 'PENDING' },
      });

      const email = order.user?.email || order.guestEmail!;
      const name = order.user?.name || order.guestName || email;

      await crmService.syncContact({
        email,
        name,
        phone: order.user?.phone || undefined,
        orderId: order.id,
        orderTotal: order.total.toNumber(),
        orderDate: order.createdAt.toISOString(),
        items: order.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          price: i.price.toNumber(),
        })),
      });

      await prisma.crmSyncLog.update({
        where: { orderId },
        data: { status: 'SUCCESS' },
      });

      console.log(`[crm-worker] Synced order ${orderId}`);
    },
    {
      connection: redis as Redis,
      concurrency: 5,
    }
  );

  worker.on('failed', async (job, err) => {
    console.error(`[crm-worker] Job failed: ${job?.data?.orderId}`, err.message);
    if (job?.data?.orderId) {
      await prisma.crmSyncLog.updateMany({
        where: { orderId: job.data.orderId },
        data: { status: 'FAILED', errorMessage: err.message },
      });
    }
  });

  console.log('[crm-worker] Started');
  return worker;
};
