import { Router } from 'express';
import {
  createCheckoutSession,
  getOrder,
  getMyOrders,
  confirmMockCheckout,
} from '../controllers/order.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Creates Stripe session (or mock session) — works for guests and logged-in users
router.post('/checkout/session', createCheckoutSession);

// Mock payment confirm — only used when STRIPE_SECRET_KEY is a placeholder
router.post('/checkout/mock-confirm', confirmMockCheckout);

// Protected — customer views own orders
router.get('/my-orders', requireAuth, getMyOrders);
router.get('/:id', requireAuth, getOrder);

export default router;
