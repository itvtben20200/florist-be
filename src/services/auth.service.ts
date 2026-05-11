import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { AppError } from '../middleware/error.middleware';
import { EmailService } from './email.service';

const emailService = new EmailService();

export class AuthService {
  async register(data: { email: string; password: string; name: string }) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new AppError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await prisma.user.create({
      data: { email: data.email, passwordHash, name: data.name },
      select: { id: true, email: true, name: true, role: true, phone: true, companyName: true },
    });

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email, user.role);
    return { accessToken, refreshToken, user };
  }

  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) throw new AppError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email, user.role);
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone, companyName: user.companyName } };
  }

  async refreshAccessToken(token: string) {
    const session = await prisma.session.findUnique({
      where: { refreshToken: token },
      include: { user: true },
    });
    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.delete({ where: { id: session.id } });
      throw new AppError(401, 'Invalid or expired refresh token');
    }

    const signOptions: SignOptions = { expiresIn: config.jwt.expiresIn as any };
    const accessToken = jwt.sign(
      { userId: session.user.id, email: session.user.email, role: session.user.role },
      config.jwt.secret,
      signOptions
    );
    return { accessToken };
  }

  async logout(refreshToken: string) {
    await prisma.session.deleteMany({ where: { refreshToken } });
  }

  async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return; // Silent — prevent email enumeration

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({ data: { email, token, expiresAt } });
    emailService
      .sendPasswordReset(email, token, user.name || '')
      .catch((err) => console.error('[auth] Password reset email failed (non-fatal):', err));

    // In dev, print the reset link so it can be tested without a real mail server
    if (process.env.NODE_ENV !== 'production') {
      const link = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
      console.log(`\n[DEV] Password reset link for ${email}:\n  ${link}\n`);
    }
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.used || record.expiresAt < new Date()) {
      throw new AppError(400, 'Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await Promise.all([
      prisma.user.update({ where: { email: record.email }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { token }, data: { used: true } }),
    ]);
  }

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, phone: true, companyName: true, createdAt: true },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) throw new AppError(400, 'No password set on this account');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new AppError(401, 'Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async updateProfile(id: string, data: { name?: string; phone?: string; companyName?: string }) {
    return prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, phone: true, companyName: true },
    });
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const signOptions: SignOptions = { expiresIn: config.jwt.expiresIn as any };
    const accessToken = jwt.sign({ userId, email, role }, config.jwt.secret, signOptions);
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({ data: { userId, refreshToken, expiresAt } });
    return { accessToken, refreshToken };
  }
}
