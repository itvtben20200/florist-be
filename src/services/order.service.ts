import Stripe from 'stripe';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { EmailService } from './email.service';
import { enqueueCrmSync } from '../lib/queue';

const emailService = new EmailService();

export class OrderService {
  async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    // Idempotency — skip if we've already processed this session
    const existing = await prisma.order.findUnique({
      where: { stripeSessionId: session.id },
    });
    if (existing) return;

    const meta = session.metadata!;
    const items: { productId: string; quantity: number }[] = JSON.parse(meta.items || '[]');
    const shippingAddress = JSON.parse(meta.shippingAddress || '{}');
    const userId = meta.userId || null;
    const guestEmail = meta.guestEmail || null;
    const guestName = meta.guestName || null;
    const guestPhone = meta.guestPhone || null;
    const guestCompany = meta.guestCompany || null;

    // Resolve user — auto-create account for guests
    let resolvedUserId = userId;
    if (!userId && guestEmail) {
      resolvedUserId = await this.resolveGuestUser(guestEmail, guestName || '', guestPhone, guestCompany);
    }

    // Fetch current product prices for order items
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });

    const orderItems = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return { productId: item.productId, quantity: item.quantity, price: product.price };
    });

    const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const total = (session.amount_total || 0) / 100;

    const order = await prisma.order.create({
      data: {
        userId: resolvedUserId,
        guestEmail: userId ? null : guestEmail,
        guestName: userId ? null : guestName,
        stripeSessionId: session.id,
        stripePaymentId: session.payment_intent as string,
        status: 'PROCESSING',
        subtotal,
        total,
        shippingAddress,
        items: { create: orderItems },
      },
      include: { items: { include: { product: true } }, user: true },
    });

    // Send confirmation emails — non-fatal: log failures but don't crash the order
    const recipientEmail = order.user?.email || order.guestEmail!;
    const emailItems = order.items.map((i) => ({
      name: i.product.name,
      quantity: i.quantity,
      price: i.price,
    }));

    Promise.all([
      emailService.sendOrderConfirmation(recipientEmail, {
        id: order.id,
        total: order.total,
        items: emailItems,
      }),
      emailService.sendAdminNewOrder({
        id: order.id,
        total: order.total,
        guestEmail: order.guestEmail,
        userName: order.user?.name,
      }),
    ]).catch((err) => console.error('[order] Email send failed (non-fatal):', err));

    // Queue CRM sync — non-fatal in environments without Redis
    enqueueCrmSync(order.id).catch((err) =>
      console.error('[order] CRM enqueue failed (non-fatal):', err)
    );
  }

  async handlePaymentFailed(intent: Stripe.PaymentIntent) {
    const email = intent.receipt_email;
    if (email) {
      emailService.sendPaymentFailed(email).catch((err) =>
        console.error('[order] Payment failed email send error (non-fatal):', err)
      );
    }
  }

  async getOrderById(orderId: string, userId: string) {
    return prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { items: { include: { product: true } } },
    });
  }

  async getOrdersByUser(userId: string, page = 1) {
    const limit = 10;
    const skip = (page - 1) * limit;
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { product: { select: { name: true, images: true } } } } },
      }),
      prisma.order.count({ where: { userId } }),
    ]);
    return { orders, total, page, pages: Math.ceil(total / limit) };
  }

  private async resolveGuestUser(email: string, name: string, phone?: string | null, company?: string | null): Promise<string> {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      // If this account still has no password, generate a fresh setup link and log/send it again
      if (!existing.passwordHash) {
        const setupToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.passwordResetToken.create({ data: { email, token: setupToken, expiresAt } });

        emailService
          .sendWelcomeWithPasswordSetup(email, name, setupToken)
          .catch((err) => console.error('[order] Welcome email failed (non-fatal):', err));

        if (process.env.NODE_ENV !== 'production') {
          const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/set-password?token=${setupToken}`;
          console.log(`\n[DEV] Set-password link for ${email} (account already existed, no password set):\n  ${link}\n`);
        }
      }
      return existing.id;
    }

    // Auto-create account with no password — send setup link
    const user = await prisma.user.create({
      data: { email, name, phone: phone || null, companyName: company || null, isGuest: true },
    });

    const setupToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.passwordResetToken.create({ data: { email, token: setupToken, expiresAt } });

    // Non-fatal: don't block order creation if SMTP is not configured
    emailService
      .sendWelcomeWithPasswordSetup(email, name, setupToken)
      .catch((err) => console.error('[order] Welcome email failed (non-fatal):', err));

    // In dev, print the set-password link so it can be tested without a real mail server
    if (process.env.NODE_ENV !== 'production') {
      const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/set-password?token=${setupToken}`;
      console.log(`\n[DEV] Set-password link for ${email}:\n  ${link}\n`);
    }

    return user.id;
  }
}
