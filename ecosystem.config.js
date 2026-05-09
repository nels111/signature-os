module.exports = {
  apps: [{
    name: 'signature-os',
    script: 'node_modules/.bin/next',
    args: 'start -p 3200',
    cwd: '/var/www/signature-cleans-os',
    env: {
      NODE_ENV: 'production',
      PORT: '3200',
    },
    max_memory_restart: '500M',
    restart_delay: 3000,
    max_restarts: 10,
  }],
};
