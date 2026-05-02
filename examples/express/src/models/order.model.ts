import { prisma } from '../config/prisma';
import { tracer } from '../config/corelens';

type CreateOrderInput = {
  customerEmail: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

export class OrderModel {
  async create(input: CreateOrderInput) {
    return tracer.withSpan('prisma.order.create', () => {
      return prisma.order.create({
        data: {
          customer: {
            connectOrCreate: {
              where: { email: input.customerEmail },
              create: { email: input.customerEmail },
            },
          },
          items: {
            create: input.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          customer: true,
          items: {
            include: { product: true },
          },
        },
      });
    });
  }

  async findById(id: string) {
    return tracer.withSpan('prisma.order.find_unique', (span) => {
      span.setAttribute('order.id', id);

      return prisma.order.findUnique({
        where: { id },
        include: {
          customer: true,
          items: {
            include: { product: true },
          },
        },
      });
    });
  }
}
