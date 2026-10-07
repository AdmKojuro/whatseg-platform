import 'dotenv/config'

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET ?? 'changeme',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '24h',
  PORT_EXT: parseInt(process.env.PORT_EXT ?? '3068', 10),
  VISION_URL: process.env.VISION_URL ?? 'http://localhost:8001',
  BACKEND_URL: process.env.BACKEND_URL ?? 'http://localhost:3067',
}

// Alias para compatibilidad
export const env = ENV
