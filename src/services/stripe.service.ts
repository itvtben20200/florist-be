import Stripe from 'stripe';
import { config } from '../config';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import { CheckoutPayload } from '../types';
import { createMockSession } from '../lib/mockSessionStore';

// Detect whether a real Stripe key has been configured
const isStripeConfigured =
  !!config.stripe.secretKey &&
  !config.stripe.secretKey.includes('...') &&
  config.stripe.secretKey !== 'sk_test_placeholder' &&
  config.stripe.secretKey.startsWith('sk_') &&
  config.stripe.secretKey.length > 30;

const stripe = isStripeConfigured ? new Stripe(config.stripe.secretKey) : null;

export class StripeService {
  async createCheckoutSession(
    payload: CheckoutPayload & { userId?: string }
  ): Promise<{ id: string; url: string }> {
    const { items, guestEmail, guestName, guestPhone, guestCompany, userId } = payload;

    // Validate products
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });

    if (products.length !== productIds.length) {
      throw new AppError(400, 'One or more products are unavailable');
    }

    const total = items.reduce((sum, item) => {
      const p = products.find((p) => p.id === item.productId)!;
      return sum + Number(p.price) * item.quantity;
    }, 0);

    // ── MOCK MODE (no Stripe key configured) ──────────────────────────────────
    if (!stripe) {
      console.warn('[stripe] No real key configured — using mock checkout.');
      const sessionProducts = items.map((item) => {
        const p = products.find((p) => p.id === item.productId)!;
        return { id: p.id, name: p.name, price: String(p.price), quantity: item.quantity };
      });
      const sessionId = createMockSession(payload, sessionProducts, total);
      return {
        id: sessionId,
        url: `${config.frontendUrl}/checkout/payment?sid=${sessionId}`,
      };
    }

    // ── REAL STRIPE MODE ────────────────────────────────────────────────────
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      return {
        price_data: {
          currency: 'eur',
          product_data: { name: product.name, images: product.images.slice(0, 1) },
          unit_amount: Math.round(Number(product.price) * 100),
        },
        quantity: item.quantity,
      };
    });

    const customerEmail = userId
      ? (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email
      : guestEmail;

    try {
      const session = await stripe!.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        line_items: lineItems,
        customer_email: customerEmail || undefined,
        success_url: `${config.frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/cart`,
        metadata: {
          userId: userId || '',
          guestEmail: guestEmail || '',
          guestName: guestName || '',
          guestPhone: guestPhone || '',
          guestCompany: guestCompany || '',
          items: JSON.stringify(items),
        },
      });
      return { id: session.id, url: session.url! };
    } catch (err: unknown) {
      const stripeErr = err as { type?: string };
      if (stripeErr.type === 'StripeAuthenticationError' || stripeErr.type === 'StripeInvalidRequestError') {
        console.warn('[stripe] API key invalid — falling back to mock checkout.');
        const sessionProducts = items.map((item) => {
          const p = products.find((p) => p.id === item.productId)!;
          return { id: p.id, name: p.name, price: String(p.price), quantity: item.quantity };
        });
        const sessionId = createMockSession(payload, sessionProducts, total);
        return { id: sessionId, url: `${config.frontendUrl}/checkout/payment?sid=${sessionId}` };
      }
      throw err;
    }
  }
}

