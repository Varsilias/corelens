import { redis } from '../config/redis';
import { logger, tracer } from '../config/corelens';
import { ProductModel } from '../models/product.model';

const productListCacheKey = 'products:list';
const cacheTtlSeconds = Number(process.env.PRODUCT_CACHE_TTL_SECONDS ?? 30);

type CreateProductInput = {
  sku: string;
  name: string;
  description?: string;
  priceCents: number;
  inventory?: number;
};

export class ProductService {
  private readonly products = new ProductModel();

  async list() {
    return tracer.withSpan('service.products.list', async () => {
      // const cached = await tracer.withSpan(
      //   'redis.products.get',
      //   async (span) => {
      //     span.setAttribute('cache.key', productListCacheKey);
      //     return redis.get(productListCacheKey);
      //   },
      // );

      // if (cached) {
      //   logger.info('Product list served from cache');
      //   return JSON.parse(cached);
      // }

      const products = await this.products.findMany();

      // await tracer.withSpan('redis.products.set', async (span) => {
      //   span.setAttribute('cache.key', productListCacheKey);
      //   await redis.set(productListCacheKey, JSON.stringify(products), {
      //     EX: cacheTtlSeconds,
      //   });
      // });

      return products;
    });
  }

  async getById(id: string) {
    return tracer.withSpan('service.products.get_by_id', () => {
      return this.products.findById(id);
    });
  }

  async create(input: CreateProductInput) {
    return tracer.withSpan('service.products.create', async () => {
      if (!input.sku || !input.name || !Number.isInteger(input.priceCents)) {
        throw new Error('sku, name, and priceCents are required');
      }

      const product = await this.products.create(input);
      await redis.del(productListCacheKey);

      return product;
    });
  }
}
