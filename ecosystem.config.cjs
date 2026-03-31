module.exports = {
  apps: [
    {
      name: "trip-auto-deploy",
      script: "./scripts/pm2-auto-update.sh",
      interpreter: "bash",
      cwd: ".",
      autorestart: true,
      env: {
        DEPLOY_REMOTE: "origin",
        DEPLOY_BRANCH: "main",
        INTERVAL_SECONDS: "300"
      }
    }
  ]
};
