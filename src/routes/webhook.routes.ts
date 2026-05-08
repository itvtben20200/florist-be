import { Router } from 'express';
import { stripeWebhook } from '../controllers/webhook.controller';

const router = Router();

// Raw body is applied in app.ts before this route
router.post('/stripe', stripeWebhook);

export default router;
