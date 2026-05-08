import { Router } from 'express';
import {
  getDashboard,
  listAllOrders,
  getOrderById,
  updateOrderStatus,
  listAllCustomers,
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/admin.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// All admin routes require auth + ADMIN or SUPERADMIN role
router.use(requireAuth, requireRole('ADMIN', 'SUPERADMIN'));

router.get('/dashboard', getDashboard);

router.get('/orders', listAllOrders);
router.get('/orders/:id', getOrderById);
router.patch('/orders/:id/status', updateOrderStatus);

router.get('/customers', listAllCustomers);

router.get('/products', listProducts);
router.post('/products', createProduct);
router.put('/products/:id', updateProduct);
router.delete('/products/:id', deleteProduct);

export default router;
