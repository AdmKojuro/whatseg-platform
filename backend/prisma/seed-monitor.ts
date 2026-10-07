import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password_hash = await bcrypt.hash('Monitor2026', 10);
  await prisma.admin.upsert({
    where: { email: 'monitoreo@whatseg.com' },
    update: {},
    create: {
      nombre: 'Monitor Principal',
      email: 'monitoreo@whatseg.com',
      password_hash,
      rol: 'MONITOR',
      activo: true,
    },
  });
  console.log('Monitor upserted: monitoreo@whatseg.com / Monitor2026');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
