module.exports = {
  apps: [
    {
      name: 'whatseg-vision',
      script: 'python',
      args: 'main.py',
      interpreter: 'none',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PYTHONUNBUFFERED: '1',
      },
      error_file: './logs/vision_err.log',
      out_file: './logs/vision_out.log',
      log_file: './logs/vision_combined.log',
      time: true,
    },
  ],
}
