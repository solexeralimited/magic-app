import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 config — database connection is passed to the PrismaClient adapter in lib/prisma.ts
// This file only specifies the schema path for the CLI tools (migrate, studio, etc.)
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
});
