import { beforeEach, describe, expect, it, vi } from "vitest";

// Automock generico de Prisma: cualquier propiedad/metodo encadenado (prisma.x.y(...))
// resuelve `undefined`. Las actions fallaran mas adelante en su logica de negocio (datos
// vacios/mockeados, destructuring de `undefined`, etc.), pero eso no importa para este
// test: el guard de permiso se invoca en la primera linea de cada action, que es lo unico
// que se verifica aqui.
function crearPrismaAutoMock(): unknown {
    const nodo = (): unknown =>
        new Proxy(function () {}, {
            get: (_objetivo, prop) => (prop === "then" ? undefined : nodo()),
            apply: () => Promise.resolve(undefined)
        });
    return nodo();
}

vi.mock("@/shared/lib/prisma", () => ({ prisma: crearPrismaAutoMock() }));
vi.mock("@/shared/lib/permisos", () => ({ requirePermiso: vi.fn() }));
vi.mock("@/shared/lib/logger", () => ({ AuditLogger: { logDataAccess: vi.fn() } }));

import { requirePermiso } from "@/shared/lib/permisos";
import type { Permiso } from "@/config/permisos";

// actions: catalogos
import { getCatalogos } from "./catalogos/actions/getCatalogos.action";
// actions: dashboard
import { getDashboardFuncionario } from "./dashboard/actions/getDashboardFuncionario.action";
// actions: some
import { getSomePanel } from "./some/actions/getSomePanel.action";
// actions: comunicador
import { actualizarUsuarioComunicador } from "./comunicador/actions/actualizarUsuarioComunicador.action";
import { getCitasPendientes } from "./comunicador/actions/getCitasPendientes.action";
import { getCitasPendientesPaciente } from "./comunicador/actions/getCitasPendientesPaciente.action";
import { getContactoPaciente } from "./comunicador/actions/getContactoPaciente.action";
import { getFiltrosComunicador } from "./comunicador/actions/getFiltrosComunicador.action";
import { getHistorialLlamadas } from "./comunicador/actions/getHistorialLlamadas.action";
import { getUsuarioParaEdicion } from "./comunicador/actions/getUsuarioParaEdicion.action";
import { registrarLlamada } from "./comunicador/actions/registrarLlamada.action";
// actions: configuracion
import {
    getMantenedoresConfig,
    guardarFuncionario,
    guardarMotivo,
    guardarPermisosRol,
    guardarPrestacion,
    guardarProfesional,
    guardarRol,
    guardarTipoSolicitud
} from "./configuracion/actions/mantenedores.action";
// actions: solicitudes
import { crearSolicitud } from "./solicitudes/actions/crearSolicitud.action";
import { gestionarSolicitud } from "./solicitudes/actions/gestionarSolicitud.action";
import { getCentros } from "./solicitudes/actions/getCentros.action";
import { getOtrasSolicitudes } from "./solicitudes/actions/getOtrasSolicitudes.action";
import { getPendientes } from "./solicitudes/actions/getPendientes.action";
import { getRevisionCatalogos } from "./solicitudes/actions/getRevisionCatalogos.action";
import { getSolicitudes } from "./solicitudes/actions/getSolicitudes.action";
import { getUsuarioPorRut } from "./solicitudes/actions/getUsuarioPorRut.action";
import { actualizarUsuario, crearUsuario } from "./solicitudes/actions/guardarUsuario.action";

const usuarioSesion = {
    rut: "11.111.111-1",
    email: "test@demo.local",
    nombre: "Test",
    centro_id: "650",
    centro_nombre: "CESFAM",
    rol: { id: 1, nombre: "Administrador" }
};

interface CasoPermiso {
    nombre: string;
    invocar: () => Promise<unknown>;
    // Orden exacto en que la action pasa las claves a requirePermiso (semantica OR).
    permisos: Permiso[];
}

// La tabla es la especificacion: se derivo leyendo el guard (primera linea de cada
// export) en src/modules/*/actions/*.action.ts, no de memoria. Hoy sistema tiene 28
// Server Actions repartidas en catalogos, comunicador, configuracion y solicitudes.
const tabla: CasoPermiso[] = [
    // catalogos
    { nombre: "getCatalogos", invocar: () => getCatalogos(), permisos: ["solicitudes.ver"] },

    // dashboard
    { nombre: "getDashboardFuncionario", invocar: () => getDashboardFuncionario(), permisos: ["dashboard.ver"] },
    { nombre: "getSomePanel", invocar: () => getSomePanel(), permisos: ["some.ver"] },

    // comunicador
    {
        nombre: "actualizarUsuarioComunicador",
        invocar: () => actualizarUsuarioComunicador({} as never),
        permisos: ["comunicador.paciente"]
    },
    { nombre: "getCitasPendientes", invocar: () => getCitasPendientes({}), permisos: ["comunicador.ver"] },
    {
        nombre: "getCitasPendientesPaciente",
        invocar: () => getCitasPendientesPaciente("11111111-1", "CITA-1"),
        permisos: ["comunicador.ver"]
    },
    { nombre: "getContactoPaciente", invocar: () => getContactoPaciente("11111111-1"), permisos: ["comunicador.ver"] },
    { nombre: "getFiltrosComunicador", invocar: () => getFiltrosComunicador(), permisos: ["comunicador.ver"] },
    { nombre: "getHistorialLlamadas", invocar: () => getHistorialLlamadas("CITA-1"), permisos: ["comunicador.ver"] },
    {
        nombre: "getUsuarioParaEdicion",
        invocar: () => getUsuarioParaEdicion("11111111-1"),
        permisos: ["comunicador.paciente"]
    },
    { nombre: "registrarLlamada", invocar: () => registrarLlamada({} as never), permisos: ["comunicador.llamar"] },

    // configuracion
    { nombre: "getMantenedoresConfig", invocar: () => getMantenedoresConfig(), permisos: ["config.ver"] },
    {
        nombre: "guardarTipoSolicitud",
        invocar: () => guardarTipoSolicitud({} as never),
        permisos: ["config.catalogos"]
    },
    { nombre: "guardarMotivo", invocar: () => guardarMotivo({} as never), permisos: ["config.catalogos"] },
    { nombre: "guardarRol", invocar: () => guardarRol({} as never), permisos: ["config.roles"] },
    {
        nombre: "guardarProfesional",
        invocar: () => guardarProfesional({} as never),
        permisos: ["config.catalogos"]
    },
    {
        nombre: "guardarPrestacion",
        invocar: () => guardarPrestacion({} as never),
        permisos: ["config.catalogos"]
    },
    {
        nombre: "guardarFuncionario",
        invocar: () => guardarFuncionario({} as never),
        permisos: ["config.funcionarios"]
    },
    { nombre: "guardarPermisosRol", invocar: () => guardarPermisosRol({} as never), permisos: ["config.roles"] },

    // solicitudes
    { nombre: "crearSolicitud", invocar: () => crearSolicitud({} as never), permisos: ["solicitudes.crear"] },
    {
        nombre: "gestionarSolicitud",
        invocar: () => gestionarSolicitud({} as never),
        permisos: ["solicitudes.gestionar"]
    },
    { nombre: "getCentros", invocar: () => getCentros(), permisos: ["solicitudes.ver", "comunicador.ver"] },
    {
        nombre: "getOtrasSolicitudes",
        invocar: () => getOtrasSolicitudes("11111111-1", "SOL-1"),
        permisos: ["solicitudes.gestionar"]
    },
    { nombre: "getPendientes", invocar: () => getPendientes("11111111-1"), permisos: ["solicitudes.ver"] },
    { nombre: "getRevisionCatalogos", invocar: () => getRevisionCatalogos(), permisos: ["solicitudes.gestionar"] },
    {
        nombre: "getSolicitudes",
        invocar: () => getSolicitudes(),
        permisos: ["solicitudes.ver", "solicitudes.gestionar"]
    },
    { nombre: "getUsuarioPorRut", invocar: () => getUsuarioPorRut("11111111-1"), permisos: ["solicitudes.ver"] },
    {
        nombre: "crearUsuario",
        invocar: () => crearUsuario({} as never),
        permisos: ["solicitudes.crear", "solicitudes.gestionar"]
    },
    {
        nombre: "actualizarUsuario",
        invocar: () => actualizarUsuario({} as never),
        permisos: ["solicitudes.crear", "solicitudes.gestionar"]
    }
];

beforeEach(() => {
    vi.clearAllMocks();
    (requirePermiso as any).mockResolvedValue(usuarioSesion);
});

describe("permiso exigido por cada Server Action", () => {
    it("cubre las 29 Server Actions del sistema", () => {
        expect(tabla.length).toBe(29);
    });

    for (const caso of tabla) {
        it(`${caso.nombre} exige ${caso.permisos.join(" o ")}`, async () => {
            // El guard `requirePermiso` es la primera linea de la action. No hace falta
            // que la action complete su logica de negocio (fallara despues, con datos
            // vacios/mockeados): descartamos ese error y solo asertamos el guard.
            await caso.invocar().catch(() => undefined);
            expect(requirePermiso).toHaveBeenCalledWith(...caso.permisos);
        });
    }
});
