import { Router } from 'express';

import { OrderController } from '../controllers/order.controller';

export const orderRoutes = Router();
const controller = new OrderController();

orderRoutes.post('/', controller.create);
orderRoutes.get('/:id', controller.getById);
