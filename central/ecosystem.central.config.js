module.exports = {
  apps: [
    {
      name: "central-dashboard",
      script: "server.js",
      cwd: "/var/www/whatseg/central",
      env: { NODE_ENV: "production" },
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
