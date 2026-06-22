module.exports = {
  apps: [
    {
      name: "tinix-web",
      script: "npx",
      args: "next start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        NODE_OPTIONS: "--max-old-space-size=2048",
      },
    },
    {
      name: "tinix-scheduler",
      script: "npx",
      args: "tsx src/workers/scheduler-worker.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        DB_MAX_CONNECTIONS: "2",
        NODE_OPTIONS: "--max-old-space-size=512",
      },
    },
    {
      // Handles both github-crawler and github-updater queues (merged)
      name: "tinix-github-worker",
      script: "npx",
      args: "tsx src/workers/crawler-worker.ts",
      instances: 2,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        DB_MAX_CONNECTIONS: "2",
        NODE_OPTIONS: "--max-old-space-size=512",
      },
    },
    {
      // Handles both hf-crawler and hf-updater queues (merged)
      name: "tinix-hf-worker",
      script: "npx",
      args: "tsx src/workers/hf-worker.ts",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        DB_MAX_CONNECTIONS: "2",
        NODE_OPTIONS: "--max-old-space-size=512",
      },
    },
  ]
};
