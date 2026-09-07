import { Router } from 'express';
import {
  getPayments,
  getPaymentSummary,
  createPayment,
  updatePayment,
  togglePaymentStatus,
  deletePayment,
  addTransaction,
} from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticate);

router.get('/', getPayments);
router.get('/summary', getPaymentSummary);
router.post('/', createPayment);
router.put('/:id', updatePayment);
router.patch('/:id/toggle', togglePaymentStatus);
router.delete('/:id', deletePayment);
router.post('/:id/transaction', addTransaction);

export default router;
