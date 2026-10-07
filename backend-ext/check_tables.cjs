const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://trdomatica:trdomatica123@127.0.0.1:5433/trdomatica' } }
});
async function main() {
  const admins = await prisma.$queryRaw`SELECT id, nombre, email, rol FROM admins ORDER BY rol`;
  console.log('\n=== ADMINS RESTAURADOS ===');
  admins.forEach(a => console.log(`  ${a.rol}: ${a.email} (${a.nombre})`));
  
  const tipos = await prisma.$queryRaw`SELECT nombre, modo_activacion FROM tipos_dispositivo`;
  console.log('\n=== TIPOS DISPOSITIVO ===');
  tipos.forEach(t => console.log(`  ${t.nombre} (${t.modo_activacion})`));
  
  const tuya = await prisma.$queryRaw`SELECT nombre, client_id FROM cuentas_tuya`;
  console.log('\n=== CUENTAS TUYA ===');
  tuya.forEach(t => console.log(`  ${t.nombre}: ${t.client_id}`));
  
  const comunidades = await prisma.$queryRaw`SELECT COUNT(*) as n FROM comunidades`;
  console.log(`\n=== COMUNIDADES: ${comunidades[0].n} registros ===`);
  
  const clientes = await prisma.$queryRaw`SELECT COUNT(*) as n FROM clientes`;
  console.log(`=== CLIENTES: ${clientes[0].n} registros ===`);
  
  const dispositivos = await prisma.$queryRaw`SELECT COUNT(*) as n FROM dispositivos`;
  console.log(`=== DISPOSITIVOS: ${dispositivos[0].n} registros ===`);
}
main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
