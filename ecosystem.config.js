module.exports = {
  apps: [
    {
      name: "tinix-web",
      script: "npx",
      args: "next dev --turbopack",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
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
    },
    {
      name: "tinix-github-worker",
      script: "npx",
      args: "tsx src/workers/crawler-worker.ts",
      // fork mode: PM2 spawns N separate node processes, each runs its own BullMQ Worker.
      // BullMQ distributes jobs across all connected workers automatically via Redis.
      instances: 3,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
    },
    {
      name: "tinix-hf-worker",
      script: "npx",
      args: "tsx src/workers/hf-worker.ts",
      instances: 2,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
    }
  ]
};
