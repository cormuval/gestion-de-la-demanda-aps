"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
// actions
import { getCitasPendientes, CitaFila } from "@/modules/comunicador/actions/getCitasPendientes.action";
import { getFiltrosComunicador } from "@/modules/comunicador/actions/getFiltrosComunicador.action";
import { getUsuarioPorRut } from "@/modules/solicitudes/actions/getUsuarioPorRut.action";
// components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CitasFiltros, CitasFiltrosUI, FILTROS_INICIALES } from "@/modules/comunicador/components/CitasFiltros";
import { CitasPendientesTabla } from "@/modules/comunicador/components/CitasPendientesTabla";
import { RegistrarLlamadaModal } from "@/modules/comunicador/components/RegistrarLlamadaModal";
import { MultiCitaPanel } from "@/modules/comunicador/components/MultiCitaPanel";
// utils
import { formatearTelefonos, formatearCorreo } from "@/modules/comunicador/utils/contacto";

type Opciones = Awaited<ReturnType<typeof getFiltrosComunicador>>;

export default function ComunicadorPage() {
    const [opciones, setOpciones] = useState<Opciones>({ profesionales: [], prestaciones: [] });
    const [filtrosUI, setFiltrosUI] = useState<CitasFiltrosUI>(FILTROS_INICIALES);
    const [aplicados, setAplicados] = useState<CitasFiltrosUI>(FILTROS_INICIALES);
    const [pagina, setPagina] = useState(1);
    const [data, setData] = useState<{ filas: CitaFila[]; total: number; pagina: number; porPagina: number }>({ filas: [], total: 0, pagina: 1, porPagina: 100 });
    const [citaSel, setCitaSel] = useState<CitaFila | null>(null);
    const [contacto, setContacto] = useState<{ telefonos: string; correo: string }>({ telefonos: "", correo: "" });

    useEffect(() => {
        getFiltrosComunicador().then(setOpciones).catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar filtros"));
    }, []);

    const cargar = useCallback(async () => {
        try {
            const r = await getCitasPendientes({
                temporalidad: aplicados.temporalidad,
                estado: aplicados.estado,
                profesional_id: aplicados.profesional_id || undefined,
                prestacion_id: aplicados.prestacion_id || undefined,
                edadMin: aplicados.edadMin || undefined,
                edadMax: aplicados.edadMax || undefined,
                fechaDesde: aplicados.fechaDesde || undefined,
                fechaHasta: aplicados.fechaHasta || undefined,
                pagina
            });
            setData(r);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Error al cargar la cola");
        }
    }, [aplicados, pagina]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    async function abrirGestion(cita: CitaFila) {
        setCitaSel(cita);
        try {
            const { usuario } = await getUsuarioPorRut(cita.rut_usuario);
            setContacto({
                telefonos: formatearTelefonos(usuario?.telefono, usuario?.telefono_alternativo),
                correo: formatearCorreo(usuario?.correo_contacto)
            });
        } catch {
            setContacto({ telefonos: formatearTelefonos(null, null), correo: formatearCorreo(null) });
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">Comunicador</h1>
                <p className="mt-1 text-sm text-muted-foreground">Gestión de citaciones pendientes: registra llamadas y cierra citas.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <CardDescription>Filtra por temporalidad, estado, profesión, prestación, edad y fecha estimada.</CardDescription>
                </CardHeader>
                <CardContent>
                    <CitasFiltros
                        opciones={opciones}
                        valor={filtrosUI}
                        onCambio={setFiltrosUI}
                        onAplicar={() => {
                            setPagina(1);
                            setAplicados(filtrosUI);
                        }}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Citaciones pendientes</CardTitle>
                    <CardDescription>Ordenadas por estado (No contesta 2 → 1 → aviso → sin llamadas) y prioridad.</CardDescription>
                </CardHeader>
                <CardContent>
                    <CitasPendientesTabla
                        filas={data.filas}
                        total={data.total}
                        pagina={data.pagina}
                        porPagina={data.porPagina}
                        onPagina={setPagina}
                        onGestionar={abrirGestion}
                    />
                </CardContent>
            </Card>

            {citaSel && (
                <RegistrarLlamadaModal
                    cita={citaSel}
                    telefonos={contacto.telefonos}
                    correo={contacto.correo}
                    onCerrar={() => setCitaSel(null)}
                    onRegistrado={(mensaje) => {
                        toast.success(mensaje);
                        setCitaSel(null);
                        cargar();
                    }}
                />
            )}
            {citaSel && (
                <div className="fixed bottom-4 right-4 z-20 w-80 rounded-lg border bg-card p-3 shadow-lg">
                    <MultiCitaPanel
                        rutUsuario={citaSel.rut_usuario}
                        citaActualId={citaSel.id_cita}
                        onGestionar={(id) => {
                            const otra = data.filas.find((f) => f.id_cita === id);
                            if (otra) abrirGestion(otra);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
