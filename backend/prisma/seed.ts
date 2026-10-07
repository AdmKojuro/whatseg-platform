import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Seed superadmins
  const superadmins = [
    { email: 'superadmin@whatseg.com', nombre: 'Super Admin', password: 'Super2026' },
    { email: 'operativo@whatseg.com', nombre: 'Operativo', password: 'Operativo2026' },
    { email: 'ventas@whatseg.com', nombre: 'Ventas', password: 'Ventas2026' },
  ];

  for (const sa of superadmins) {
    const password_hash = await bcrypt.hash(sa.password, 10);
    await prisma.admin.upsert({
      where: { email: sa.email },
      update: { password_hash, activo: true },
      create: {
        nombre: sa.nombre,
        email: sa.email,
        password_hash,
        rol: 'SUPERADMIN',
        activo: true,
      },
    });
    console.log(`Superadmin upserted: ${sa.email} / ${sa.password}`);
  }

  // Seed default device types
  await prisma.tipoDispositivo.upsert({
    where: { nombre: 'ALARMA' },
    update: {},
    create: { nombre: 'ALARMA', modo_activacion: 'GRUPAL' },
  });
  await prisma.tipoDispositivo.upsert({
    where: { nombre: 'PUERTA' },
    update: {},
    create: { nombre: 'PUERTA', modo_activacion: 'INDIVIDUAL' },
  });
  await prisma.tipoDispositivo.upsert({
    where: { nombre: 'CAMARA' },
    update: {},
    create: { nombre: 'CAMARA', modo_activacion: 'NONE' },
  });
  console.log('Default device types seeded: ALARMA (GRUPAL), PUERTA (INDIVIDUAL), CAMARA (NONE)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
