import type { Request, Response, NextFunction } from 'express';
import { AdminUser } from '../models/AdminUser.model';
import { comparePassword, generateToken } from '../services/auth.service';
import { sendSuccess, sendError } from '../utils/response';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await AdminUser.findOne({ email, active: true }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
      return;
    }
    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      sendError(res, 'Invalid credentials', 401, 'INVALID_CREDENTIALS');
      return;
    }
    await AdminUser.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
    const token = generateToken({ userId: String(user._id), email: user.email, role: user.role });
    sendSuccess(res, { token, user: { email: user.email, role: user.role } }, 200, 'Login successful');
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, null, 200, 'Logged out successfully');
}