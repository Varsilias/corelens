import { Router } from 'express';

import { productRoutes } from './product.routes';
import { orderRoutes } from './order.routes';

export const routes = Router();

routes.use('/products', productRoutes);
routes.use('/orders', orderRoutes);
