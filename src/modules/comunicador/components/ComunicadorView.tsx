"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
// actions
import { getCitasPendientes, CitaFila } from "@/modules/comunicador/actions/getCitasPendientes.action";
import { getFiltrosComunicador } from "@/modules/comunicador/actions/getFiltrosComunicador.action";
import { getContactoPaciente } from "@/modules/comunicador/actions/getContactoPaciente.action";
import { getCentros, type CentroOption } from "@/modules/solicitudes/actions/getCentros.action";
// components
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CitasFiltros, CitasFiltrosUI, FILTROS_INICIALES } from "@/modules/comunicador/components/CitasFiltros";
import { CitasPendientesTabla } from "@/modules/comunicador/components/CitasPendientesTabla";
import { RegistrarLlamadaModal } from "@/modules/comunicador/components/RegistrarLlamadaModal";
import { CitaAccionesMenu } from "@/modules/comunicador/components/CitaAccionesMenu";
import { HistorialLlamadasModal } from "@/modules/comunicador/components/HistorialLlamadasModal";
import { OtrasCitasPacienteModal } from "@/modules/comunicador/components/OtrasCitasPacienteModal";
import { UsuarioEditModal } from "@/modules/solicitudes/components/UsuarioEditModal";
import { TablaSkeleton } from "@/shared/components/feedback/tabla-skeleton";
import { PanelFiltros, contarFiltrosActivos } from "@/shared/components/filtros/panel-filtros";
// hooks
import { useUsuarioEdit } from "@/modules/comunicador/hooks/useUsuarioEdit";

type Opciones = Awaited<ReturnType<typeof getFiltrosComunicador>>;

export function ComunicadorView() {
    const [opciones, setOpciones] = useState<Opciones>({ profesionales: [], prestaciones: [] });
    const [filtrosUI, setFiltrosUI] = useState<CitasFiltrosUI>(FILTROS_INICIALES);
    const [aplicados, setAplicados] = useState<CitasFiltrosUI>(FILTROS_INICIALES);
    const [pagina, setPagina] = useState(1);
    const [data, setData] = useState<{ filas: CitaFila[]; total: number; pagina: number; porPagina: number } | null>(null);
    // Ante una falla se conserva la ultima cola cargada y se ofrece reintentar.
    const [errorCola, setErrorCola] = useState<string | null>(null);
    const [cargando, setCargando] = useState(true);
    const [citaSel, setCitaSel] = useState<CitaFila | null>(null);
    const [contacto, setContacto] = useState<{ telefonos: string; correo: string }>({ telefonos: "", correo: "" });
    const [citaHistorial, setCitaHistorial] = useState<CitaFila | null>(null);
    const [citaOtras, setCitaOtras] = useState<CitaFila | null>(null);

    useEffect(() => {
        getFiltrosComunicador().then(setOpciones).catch(() => toast.error("Error al cargar filtros"));
    }, []);

    const cargar = useCallback(async () => {
        setCargando(true);
        setErrorCola(null);
        try {
            const r = await getCitasPendientes({
                temporalidad: aplicados.temporalidad,
                estado: aplicados.estado,
                profesional_id: aplicados.profesional_id || undefined,
                prestacion: aplicados.prestacion || undefined,
                edadMin: aplicados.edadMin || undefined,
                edadMax: aplicados.edadMax || undefined,
                fechaDesde: aplicados.fechaDesde || undefined,
                fechaHasta: aplicados.fechaHasta || undefined,
                rut: aplicados.rut || undefined,
                sector: aplicados.sector || undefined,
                pagina
            });
            if (!r.ok) {
                setErrorCola(r.error);
                toast.error(r.error);
                return;
            }
            setData(r.data);
        } catch {
            const mensaje = "Error al cargar la cola";
            setErrorCola(mensaje);
            toast.error(mensaje);
        } finally {
            setCargando(false);
        }
    }, [aplicados, pagina]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const [centros, setCentros] = useState<CentroOption[]>([]);
    const editarPaciente = useUsuarioEdit(cargar);

    useEffect(() => {
        getCentros().then(setCentros).catch(() => toast.error("Error al cargar centros"));
    }, []);

    async function abrirGestion(cita: CitaFila) {
        setCitaSel(cita);
        try {
            const contacto = await getContactoPaciente(cita.rut_usuario);
            setContacto(contacto);
        } catch {
            setContacto({ telefonos: "Sin telefono(s) registrados", correo: "Correo electrónico de contacto no registrado" });
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">Contactar pacientes</h1>
                <p className="mt-1 text-sm text-muted-foreground">Gestión de citaciones pendientes: registra llamadas y cierra citas.</p>
            </div>

            <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                    <div className="space-y-1.5">
                        <CardTitle>Citaciones pendientes</CardTitle>
                        <CardDescription>Ordenadas por estado (No contesta 2 → 1 → aviso → sin llamadas) y prioridad.</CardDescription>
                    </div>
                    <PanelFiltros
                        descripcion="Filtra por temporalidad, estado, profesión, prestación, edad, fecha estimada, RUT y sector."
                        activos={contarFiltrosActivos(aplicados, [], FILTROS_INICIALES)}
                        onAplicar={() => {
                            setPagina(1);
                            setAplicados(filtrosUI);
                        }}
                        onLimpiar={() => {
                            setFiltrosUI(FILTROS_INICIALES);
                            setPagina(1);
                            setAplicados(FILTROS_INICIALES);
                        }}
                    >
                        <CitasFiltros opciones={opciones} valor={filtrosUI} onCambio={setFiltrosUI} />
                    </PanelFiltros>
                </CardHeader>
                <CardContent className="space-y-4">
                    {errorCola && (
                        <Alert variant="destructive">
                            <CircleAlert />
                            <AlertTitle>No fue posible cargar las citaciones</AlertTitle>
                            <AlertDescription className="flex flex-col items-start gap-3">
                                <p>{data ? `${errorCola}. Se muestra la última cola cargada.` : errorCola}</p>
                                <Button type="button" variant="outline" size="sm" disabled={cargando} onClick={cargar}>
                                    {cargando ? "Reintentando..." : "Reintentar"}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    )}
                    {!data && cargando && <TablaSkeleton columnas={6} etiqueta="Cargando citaciones..." />}
                    {data && (
                        <CitasPendientesTabla
                            filas={data.filas}
                            total={data.total}
                            pagina={data.pagina}
                            porPagina={data.porPagina}
                            onPagina={setPagina}
                            onGestionar={abrirGestion}
                            renderAcciones={(cita) => (
                                <CitaAccionesMenu
                                    cita={cita}
                                    onVerHistorial={setCitaHistorial}
                                    onVerOtrasCitas={setCitaOtras}
                                    onEditarPaciente={(c) => editarPaciente.abrir(c.rut_usuario)}
                                />
                            )}
                        />
                    )}
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

            {citaHistorial && (
                <HistorialLlamadasModal citaId={citaHistorial.id_cita} onCerrar={() => setCitaHistorial(null)} />
            )}

            {citaOtras && (
                <OtrasCitasPacienteModal rutUsuario={citaOtras.rut_usuario} citaActualId={citaOtras.id_cita} onCerrar={() => setCitaOtras(null)} />
            )}

            {editarPaciente.open && (
                <UsuarioEditModal
                    form={editarPaciente.form}
                    centros={centros.map((c) => ({ id_centro: c.id_centro, nombre_centro: c.nombre_centro }))}
                    saving={editarPaciente.saving}
                    onChange={editarPaciente.onChange}
                    onClose={editarPaciente.cerrar}
                    onSubmit={editarPaciente.onSubmit}
                />
            )}
        </div>
    );
}
