module.exports = {
  apps: [
    {
      name: "breakout-scanner",
      script: "./scripts/breakout-scanner.js",
      cwd: "/root/aigoat",
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G",
      error_file: "/root/logs/breakout-scanner-error.log",
      out_file: "/root/logs/breakout-scanner-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
