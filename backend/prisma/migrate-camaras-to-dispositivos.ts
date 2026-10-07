/**
 * Data migration: Camara → Dispositivo tipo CAMARA
 *
 * Run: npx tsx prisma/migrate-camaras-to-dispositivos.ts
 * Idempotente: safe to re-run (uses findFirst + conditional create)
 * Transactional: all-or-nothing via prisma.$transaction
 *
 * Rollback:
 *   UPDATE dispositivos SET camara_dispositivo_id = NULL WHERE camara_dispositivo_id IS NOT NULL;
 *   DELETE FROM dispositivos WHERE tipo = 'CAMARA' AND dolynk_device_id IS NOT NULL;
 *   DELETE FROM dispositivos WHERE tipo = 'CAMARA' AND url_rtsp IS NOT NULL AND tuya_id IS NULL AND thinmoo_dev_sn IS NULL;
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('[Migration] Starting Camara → Dispositivo migration...');

  await prisma.$transaction(async (tx) => {
    const camaras = await tx.camara.findMany();
    console.log(`[Migration] Found ${camaras.length} cameras to migrate`);

    const camaraToDispId = new Map<string, string>();

    for (const cam of camaras) {
      // Check if already migrated (idempotent)
      let existing = null;

      if (cam.dolynk_device_id && cam.cuenta_dolynk_id) {
        // Dolynk camera: find by unique constraint
        existing = await tx.dispositivo.findFirst({
          where: { cuenta_dolynk_id: cam.cuenta_dolynk_id, dolynk_device_id: cam.dolynk_device_id },
        });
      } else {
        // RTSP camera: find by nombre + comunidad_id (natural key)
        existing = await tx.dispositivo.findFirst({
          where: {
            nombre: cam.nombre,
            comunidad_id: cam.comunidad_id,
            tipo: 'CAMARA',
            // Ensure it's not a Tuya/Thinmoo device with the same name
            tuya_id: null,
            thinmoo_dev_sn: null,
          },
        });
      }

      if (existing) {
        console.log(`[Migration] Camera "${cam.nombre}" already migrated (disp ${existing.id})`);
        camaraToDispId.set(cam.id, existing.id);
        continue;
      }

      // Create new Dispositivo from Camara
      const disp = await tx.dispositivo.create({
        data: {
          nombre: cam.nombre,
          tipo: 'CAMARA',
          configurado: true,
          online: cam.activa,
          dolynk_device_id: cam.dolynk_device_id,
          dolynk_channel_id: cam.dolynk_channel_id,
          cuenta_dolynk_id: cam.cuenta_dolynk_id,
          url_rtsp: cam.url_rtsp,
          url_http: cam.url_http,
          comunidad_id: cam.comunidad_id,
        },
      });

      console.log(`[Migration] Created Dispositivo "${cam.nombre}" (${disp.id}) from Camara ${cam.id}`);
      camaraToDispId.set(cam.id, disp.id);
    }

    // Re-link: dispositivos with camara_id → camara_dispositivo_id
    const disposConCamara = await tx.dispositivo.findMany({
      where: { camara_id: { not: null } },
    });

    let relinked = 0;
    for (const d of disposConCamara) {
      if (!d.camara_id) continue;
      const newCamaraDispId = camaraToDispId.get(d.camara_id);
      if (newCamaraDispId && !d.camara_dispositivo_id) {
        await tx.dispositivo.update({
          where: { id: d.id },
          data: { camara_dispositivo_id: newCamaraDispId },
        });
        relinked++;
        console.log(`[Migration] Re-linked device "${d.nombre}" → camera device ${newCamaraDispId}`);
      }
    }

    console.log(`[Migration] Done: ${camaraToDispId.size} cameras migrated, ${relinked} devices re-linked`);
  });
}

migrate()
  .then(() => {
    console.log('[Migration] Success');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Migration] FAILED:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
