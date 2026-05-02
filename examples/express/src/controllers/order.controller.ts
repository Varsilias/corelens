import type { Request, Response, NextFunction } from 'express';

import { ecommerceRequestsTotal, tracer } from '../config/corelens';
import { OrderService } from '../services/order.service';

export class OrderController {
  private readonly orders = new OrderService();

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      ecommerceRequestsTotal.inc(1, { route: 'POST /api/orders' });

      const order = await tracer.withSpan('controller.orders.create', () => {
        return this.orders.create(req.body);
      });

      res.status(201).json({ data: order });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      ecommerceRequestsTotal.inc(1, { route: 'GET /api/orders/:id' });

      const order = await tracer.withSpan('controller.orders.get_by_id', () => {
        return this.orders.getById(req.params.id as string);
      });

      if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }

      res.json({ data: order });
    } catch (error) {
      next(error);
    }
  };
}
