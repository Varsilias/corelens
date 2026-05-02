import type { Request, Response, NextFunction } from 'express';

import { ecommerceRequestsTotal, tracer } from '../config/corelens';
import { ProductService } from '../services/product.service';

export class ProductController {
  private readonly products = new ProductService();

  list = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      ecommerceRequestsTotal.inc(1, { route: 'GET /api/products' });

      const data = await tracer.withSpan('controller.products.list', () => {
        return this.products.list();
      });

      res.json({ data });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      ecommerceRequestsTotal.inc(1, { route: 'GET /api/products/:id' });

      const product = await tracer.withSpan(
        'controller.products.get_by_id',
        () => {
          return this.products.getById(String(req.params.id));
        },
      );

      if (!product) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }

      res.json({ data: product });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      ecommerceRequestsTotal.inc(1, { route: 'POST /api/products' });

      const product = await tracer.withSpan('controller.products.create', () => {
        return this.products.create(req.body);
      });

      res.status(201).json({ data: product });
    } catch (error) {
      next(error);
    }
  };
}
