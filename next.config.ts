import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Rutas renombradas (20/10/2026): las antiguas siguen funcionando para favoritos y enlaces.
    async redirects() {
        return [
            { source: "/solicitudes/ingresar", destination: "/solicitudes/crear", permanent: true },
            { source: "/solicitudes/revisar", destination: "/solicitudes/gestionar", permanent: true },
            { source: "/comunicador", destination: "/contactar", permanent: true }
        ];
    }
};

export default nextConfig;
