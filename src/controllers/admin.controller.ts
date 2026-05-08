import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { OrderStatus } from '@prisma/client';

export const getDashboard = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalOrders, totalRevenue, refundedRevenue, newCustomers, recentOrders] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: { not: 'REFUNDED' } },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { status: 'REFUNDED' },
      }),
      prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } }, items: { include: { product: { select: { name: true } } } } },
      }),
    ]);
    res.json({
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      refundedAmount: refundedRevenue._sum.total ?? 0,
      newCustomers,
      recentOrders,
    });
  } catch (err) {
    next(err);
  }
};

export const listAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status as OrderStatus | undefined;
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true, name: true } }, items: true },
      }),
      prisma.order.count({ where }),
    ]);
    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

export const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { email: true, name: true, phone: true } },
        items: { include: { product: true } },
        crmSyncLog: true,
      },
    });
    if (!order) { res.status(404).json({ error: 'Order not found' }); return; }
    res.json(order);
  } catch (err) {
    next(err);
  }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = z.object({ status: z.nativeEnum(OrderStatus) }).parse(req.body);
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(order);
  } catch (err) {
    next(err);
  }
};

export const listAllCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const [customers, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'CUSTOMER' },
        skip, take: limit,
        select: { id: true, email: true, name: true, createdAt: true, _count: { select: { orders: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
    ]);
    res.json({ customers, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

export const listProducts = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(products);
  } catch (err) { next(err); }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string(), slug: z.string(), description: z.string().optional(),
      price: z.number().positive(), stock: z.number().int().min(0),
      images: z.array(z.string()).optional(),
    });
    const data = schema.parse(req.body);
    const product = await prisma.product.create({ data });
    res.status(201).json(product);
  } catch (err) { next(err); }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: req.body });
    res.json(product);
  } catch (err) { next(err); }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
    res.json({ message: 'Product deactivated' });
  } catch (err) { next(err); }
};
