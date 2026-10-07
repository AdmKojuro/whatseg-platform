import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Migración manual ===\n');

  // 1. Rellenar identificador NULL con "Sin asignar"
  const nullRows: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM clientes WHERE identificador IS NULL`);
  const nullCount = Number(nullRows[0].count);
  console.log(`[1/3] Clientes con identificador NULL: ${nullCount}`);
  if (nullCount > 0) {
    await prisma.$executeRawUnsafe(`UPDATE clientes SET identificador = 'Sin asignar' WHERE identificador IS NULL`);
    console.log(`      → Actualizados a "Sin asignar"`);
  }

  // 2. Hacer identificador NOT NULL
  console.log('[2/3] ALTER clientes: identificador NOT NULL...');
  await prisma.$executeRawUnsafe(`ALTER TABLE clientes ALTER COLUMN identificador SET NOT NULL`);
  console.log('      → OK');

  // 3. Activaciones: cliente_id nullable + agregar jefe_id
  console.log('[3/3] ALTER activaciones: cliente_id nullable + jefe_id...');
  await prisma.$executeRawUnsafe(`ALTER TABLE activaciones ALTER COLUMN cliente_id DROP NOT NULL`);
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activaciones' AND column_name = 'jefe_id') THEN
        ALTER TABLE activaciones ADD COLUMN jefe_id TEXT;
        ALTER TABLE activaciones ADD CONSTRAINT activaciones_jefe_id_fkey FOREIGN KEY (jefe_id) REFERENCES jefes(id) ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$
  `);
  console.log('      → OK');

  console.log('\n=== Migración completada ===');
}

main()
  .catch((e) => {
    console.error('Error en migración:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
