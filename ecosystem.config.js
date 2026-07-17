// Configuracion pm2 para produccion (servidor informesdiarios).
// La app se sirve con `next start` en el puerto 3010 detras de nginx (vhost gd2.cmvalparaiso.cl).
// El deploy la publica con: pm2 startOrReload ecosystem.config.js --update-env
module.exports = {
    apps: [
        {
            name: "gestion-demanda",
            cwd: __dirname,
            script: "node_modules/next/dist/bin/next",
            args: "start -p 3010",
            instances: 1,
            exec_mode: "fork",
            autorestart: true,
            max_memory_restart: "500M",
            env: {
                NODE_ENV: "production",
                PORT: "3010"
            }
        }
    ]
};
