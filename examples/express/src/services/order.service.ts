import { tracer } from '../config/corelens';
import { OrderModel } from '../models/order.model';

type CreateOrderInput = {
  customerEmail: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

export class OrderService {
  private readonly orders = new OrderModel();

  async create(input: CreateOrderInput) {
    return tracer.withSpan('service.orders.create', async (span) => {
      span.setAttribute('order.item_count', String(input.items?.length ?? 0));

      if (!input.customerEmail || !Array.isArray(input.items) || input.items.length === 0) {
        throw new Error('customerEmail and at least one item are required');
      }

      return this.orders.create(input);
    });
  }

  async getById(id: string) {
    return tracer.withSpan('service.orders.get_by_id', () => {
      return this.orders.findById(id);
    });
  }
}
