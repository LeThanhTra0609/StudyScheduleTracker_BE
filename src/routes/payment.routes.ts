import { Router } from 'express';
import {
  getPayments,
  getPaymentSummary,
  createPayment,
  updatePayment,
  addTransaction,
} from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', getPayments);
router.get('/summary', getPaymentSummary);
router.post('/', createPayment);
router.put('/:id', updatePayment);
router.post('/:id/transaction', addTransaction);

export default router;
