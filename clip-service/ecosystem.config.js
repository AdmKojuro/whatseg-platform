module.exports = {
  apps: [{
    name: 'clip-service',
    script: 'clip-service.js',
    cwd: '/var/www/whatseg/clip-service',
    env: {
      NODE_ENV: 'production',
      CLIP_PORT: 3069,
      CLIP_DIR: '/var/www/whatseg/clips',
      CLIP_DURATION: 5,
      CLIP_MAX_AGE_HOURS: 24,
      DATABASE_URL: 'postgresql://trdomatica:trdomatica123@localhost:5432/trdomatica',
    },
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/var/www/whatseg/clip-service/logs/err.log',
    out_file: '/var/www/whatseg/clip-service/logs/out.log',
    max_restarts: 10,
    restart_delay: 5000,
  }],
};
