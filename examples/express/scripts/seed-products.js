#!/usr/bin/env node

const { productCount } = require('./lib/config');
const { seedProducts } = require('./lib/products');

async function main() {
  const products = await seedProducts(productCount);
  console.log(
    JSON.stringify(
      {
        created: products.length,
        ids: products.map((product) => product.id),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
