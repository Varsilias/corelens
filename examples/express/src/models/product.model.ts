import { prisma } from '../config/prisma';
import { tracer } from '../config/corelens';

type CreateProductInput = {
  sku: string;
  name: string;
  description?: string;
  priceCents: number;
  inventory?: number;
};

export class ProductModel {
  async findMany() {
    return tracer.withSpan('prisma.product.find_many', () => {
      return prisma.product.findMany({
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  async findById(id: string) {
    return tracer.withSpan('prisma.product.find_unique', (span) => {
      span.setAttribute('product.id', id);

      return prisma.product.findUnique({
        where: { id },
      });
    });
  }

  async create(input: CreateProductInput) {
    return tracer.withSpan('prisma.product.create', () => {
      return prisma.product.create({
        data: {
          sku: input.sku,
          name: input.name,
          description: input.description,
          priceCents: input.priceCents,
          inventory: input.inventory ?? 0,
        },
      });
    });
  }
}
