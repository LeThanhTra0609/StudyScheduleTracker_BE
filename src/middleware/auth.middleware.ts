import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User, IUser, UserRole } from '../models/User.model';

export interface AuthRequest extends Request {
  userId?: string;
  user?: IUser;
  role?: UserRole;
  targetUserId?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as { userId: string };

    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      res.status(401).json({ success: false, message: 'User not found' });
      return;
    }

    req.userId = decoded.userId;
    req.user = user;
    req.role = user.role;

    if (user.role === 'STUDENT') {
      req.targetUserId = decoded.userId;
    } else if (user.role === 'PARENT') {
      const requestedStudentId = (req.headers['x-student-id'] as string) || (req.query.studentId as string);
      if (requestedStudentId) {
        const isChild = user.children?.some(c => c.toString() === requestedStudentId);
        if (isChild) {
          req.targetUserId = requestedStudentId;
        } else {
          res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập dữ liệu của học sinh này' });
          return;
        }
      } else if (user.children && user.children.length > 0) {
        req.targetUserId = user.children[0].toString();
      } else {
        req.targetUserId = undefined;
      }
    }

    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};
