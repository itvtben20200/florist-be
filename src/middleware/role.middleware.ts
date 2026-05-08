import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';

type AllowedRole = 'CUSTOMER' | 'ADMIN' | 'SUPERADMIN';

export const requireRole = (...roles: AllowedRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: insufficient permissions' });
      return;
    }
    next();
  };
};
