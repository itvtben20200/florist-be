import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { OrderService } from '../services/order.service';
import { StripeService } from '../services/stripe.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getMockSession, deleteMockSession } from '../lib/mockSessionStore';
import { config } from '../config';
import { prisma } from '../lib/prisma';

const orderService = new OrderService();
const stripeService = new StripeService();

const checkoutSchema = z.object({
  items: z.array(
    z.object({ productId: z.string(), quantity: z.number().int().min(1) })
  ).min(1),
  shippingAddress: z.object({
    name: z.string(),
    street: z.string(),
    city: z.string(),
    state: z.string().optional(),
    country: z.string(),
    zip: z.string(),
    phone: z.string().optional(),
  }).optional(),
  guestEmail: z.string().email().optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  guestCompany: z.string().optional(),
});

export const createCheckoutSession = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = checkoutSchema.parse(req.body);
    const userId = req.user?.userId;

    const session = await stripeService.createCheckoutSession({
      ...data,
      userId,
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    next(err);
  }
};

export const getOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user!.userId);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json(order);
  } catch (err) {
    next(err);
  }
};

export const getMyOrders = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const page = Number(req.query.page) || 1;
    const orders = await orderService.getOrdersByUser(req.user!.userId, page);
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

/**
 * Mock-only endpoint: confirms a fake payment and returns a redirect URL.
 * Called by the /checkout/payment page when Stripe is not configured.
 * Automatically unused once a real Stripe key is added.
 */
export const confirmMockCheckout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sid } = req.query as { sid?: string };
    if (!sid) {
      res.status(400).json({ error: 'Missing session id' });
      return;
    }

    const session = getMockSession(sid);
    if (!session) {
      res.status(404).json({ error: 'Session expired or not found' });
      return;
    }

    // Build a mock Stripe-like session object so handleCheckoutCompleted can process it
    const { payload, products, total } = session;
    const mockStripeSession = {
      id: sid,
      payment_intent: `mock_pi_${sid}`,
      amount_total: Math.round(total * 100),
      metadata: {
        userId: payload.userId || '',
        guestEmail: payload.guestEmail || '',
        guestName: payload.guestName || '',
        guestPhone: payload.guestPhone || '',
        guestCompany: payload.guestCompany || '',
        items: JSON.stringify(
          products.map((p) => ({ productId: p.id, quantity: p.quantity }))
        ),
        shippingAddress: '{}',
      },
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

    await orderService.handleCheckoutCompleted(mockStripeSession);
    deleteMockSession(sid);

    // Detect whether the guest email belongs to a new (passwordless) account
    // so the success page can show the right call-to-action
    let accountStatus = 'existing';
    let autologinToken = '';
    const guestEmail = payload.guestEmail;
    if (guestEmail && !payload.userId) {
      const user = await prisma.user.findUnique({
        where: { email: guestEmail },
        select: { id: true, passwordHash: true },
      });
      if (user) {
        if (!user.passwordHash) accountStatus = 'new';
        // Issue a short-lived (10 min) auto-login token for all guest checkouts
        autologinToken = jwt.sign(
          { userId: user.id, type: 'autologin' },
          config.jwt.secret,
          { expiresIn: '10m' }
        );
      }
    }

    const params = new URLSearchParams({ session_id: sid, account_status: accountStatus });
    if (autologinToken) params.set('alt', autologinToken);
    const redirectUrl = `${config.frontendUrl}/checkout/success?${params.toString()}`;
    res.json({ url: redirectUrl });
  } catch (err) {
    next(err);
  }
};
