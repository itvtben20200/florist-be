import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export const listProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where: { isActive: true } }),
    ]);

    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await prisma.product.findUnique({
      where: { slug: req.params.slug, isActive: true },
    });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};
