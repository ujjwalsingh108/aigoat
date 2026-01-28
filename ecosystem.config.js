/**
 * PM2 Ecosystem Configuration
 * Manages all scanner processes (Segmented + Batch Architecture)
 * 
 * Usage:
 *   pm2 start ecosystem.config.js           # Start all scanners
 *   pm2 stop all                            # Stop all scanners
 *   pm2 restart all                         # Restart all scanners
 *   pm2 logs                                # View logs
 *   pm2 monit                               # Monitor resources
 *   pm2 status                              # Check status
 */

module.exports = {
  apps: [
    {
      name: "nse-equity-scanner",
      script: "./scripts/nse-equity-scanner.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "30s",
      env: {
        NODE_ENV: "production",
        SCANNER_NAME: "NSE_EQUITY",
        SCAN_INTERVAL_MS: "60000", // 60 seconds
      },
      error_file: "./logs/nse-equity-error.log",
      out_file: "./logs/nse-equity-out.log",
      time: true,
      cron_restart: "0 9 * * 1-5", // Restart at 9 AM on weekdays
    },
    {
      name: "bse-equity-scanner",
      script: "./scripts/bse-equity-scanner.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "30s",
      env: {
        NODE_ENV: "production",
        SCANNER_NAME: "BSE_EQUITY",
        SCAN_INTERVAL_MS: "60000", // 60 seconds
      },
      error_file: "./logs/bse-equity-error.log",
      out_file: "./logs/bse-equity-out.log",
      time: true,
      cron_restart: "0 9 * * 1-5",
    },
    {
      name: "nse-fo-scanner",
      script: "./scripts/nse-fo-scanner.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "30s",
      env: {
        NODE_ENV: "production",
        SCANNER_NAME: "NSE_FO",
        SCAN_INTERVAL_MS: "60000", // 60 seconds
      },
      error_file: "./logs/nse-fo-error.log",
      out_file: "./logs/nse-fo-out.log",
      time: true,
      cron_restart: "0 9 * * 1-5",
    },
    {
      name: "bse-fo-scanner",
      script: "./scripts/bse-fo-scanner.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "800M",
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "30s",
      env: {
        NODE_ENV: "production",
        SCANNER_NAME: "BSE_FO",
        SCAN_INTERVAL_MS: "60000", // 60 seconds
      },
      error_file: "./logs/bse-fo-error.log",
      out_file: "./logs/bse-fo-out.log",
      time: true,
      cron_restart: "0 9 * * 1-5",
    },
  ],

  // Deploy configuration (optional - for PM2 deploy)
  deploy: {
    production: {
      user: "root",
      host: "YOUR_DROPLET_IP",
      ref: "origin/main",
      repo: "YOUR_GIT_REPO",
      path: "/var/www/aigoat",
      "post-deploy":
        "npm install && pm2 reload ecosystem.config.js --env production",
    },
  },
};
