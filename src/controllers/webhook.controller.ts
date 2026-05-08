import { Request, Response } from 'express';
import Stripe from 'stripe';
import { config } from '../config';
import { OrderService } from '../services/order.service';

const stripe = new Stripe(config.stripe.secretKey);
const orderService = new OrderService();

export const stripeWebhook = async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[webhook] Signature verification failed:', message);
    res.status(400).json({ error: `Webhook error: ${message}` });
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await orderService.handleCheckoutCompleted(session);
        break;
      }
      case 'payment_intent.payment_failed': {
        const intent = event.data.object as Stripe.PaymentIntent;
        await orderService.handlePaymentFailed(intent);
        break;
      }
      default:
        // Unhandled event types are safely ignored
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[webhook] Handler error:', err);
    // Return 200 to Stripe to prevent retries for app-level errors
    res.json({ received: true });
  }
};
