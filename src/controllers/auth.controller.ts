import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { AuthService } from '../services/auth.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';
import { config } from '../config';
import { prisma } from '../lib/prisma';

const authService = new AuthService();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(201).json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data.email, data.password);
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken: result.accessToken, user: result.user });
  } catch (err) {
    next(err);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) throw new AppError(401, 'No refresh token');
    const result = await authService.refreshAccessToken(token);
    res.json({ accessToken: result.accessToken });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) await authService.logout(token);
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await authService.forgotPassword(email);
    // Always return success to prevent email enumeration
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = z
      .object({ token: z.string(), newPassword: z.string().min(8) })
      .parse(req.body);
    await authService.resetPassword(token, newPassword);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Exchange a short-lived auto-login token (issued after checkout) for a real session.
 * Token is a signed JWT with type:'autologin', valid for 10 minutes, single-use.
 */
export const autologin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);

    let payload: any;
    try {
      payload = jwt.verify(token, config.jwt.secret);
    } catch {
      throw new AppError(401, 'Invalid or expired auto-login token');
    }

    if (payload.type !== 'autologin') throw new AppError(401, 'Invalid token type');

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw new AppError(401, 'User not found');

    // Issue real session tokens
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    const crypto = await import('crypto');
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({ data: { userId: user.id, refreshToken, expiresAt } });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ accessToken, user });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getUserById(req.user!.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) })
      .parse(req.body);
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).max(100).optional(),
        phone: z.string().max(30).optional(),
        companyName: z.string().max(200).optional(),
      })
      .parse(req.body);
    const user = await authService.updateProfile(req.user!.userId, data);
    res.json(user);
  } catch (err) {
    next(err);
  }
};
