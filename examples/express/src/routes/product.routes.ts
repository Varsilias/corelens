import { Router } from 'express';

import { ProductController } from '../controllers/product.controller';

export const productRoutes = Router();
const controller = new ProductController();

productRoutes.get('/', controller.list);
productRoutes.post('/', controller.create);
productRoutes.get('/:id', controller.getById);
