/**
 * Seed the demo dataset into the database in DATABASE_URL.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { seedDemo } from "../src/lib/demo-seed";

seedDemo()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
