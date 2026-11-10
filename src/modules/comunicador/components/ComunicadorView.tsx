"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
// actions
import { getCitasPendientes, CitaFila } from "@/modules/comunicador/actions/getCitasPendientes.action";
import { getFiltrosComunicador } from "@/modules/comunicador/actions/getFiltrosComunicador.action";
import { getContactoPaciente } from "@/modules/comunicador/actions/getContactoPaciente.action";
import { verificarCitaPendiente } from "@/modules/comunicador/actions/verificarCitaPendiente.action";
import { getCentros, type CentroOption } from "@/modules/solicitudes/actions/getCentros.action";
// components
import { Alert, AlertDescription, AlertTitle } from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CitasFiltros, CitasFiltrosUI, FILTROS_INICIALES, detalleFiltrosActivos } from "@/modules/comunicador/components/CitasFiltros";
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
import { useRefrescoAutomatico } from "@/shared/hooks/useRefrescoAutomatico";

type Opciones = Awaited<ReturnType<typeof getFiltrosComunicador>>;

interface ConsultaCola {
    aplicados: CitasFiltrosUI;
    pagina: number;
}

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
    const [citaSiguienteId, setCitaSiguienteId] = useState<string | null>(null);

    useEffect(() => {
        getFiltrosComunicador().then(setOpciones).catch(() => toast.error("Error al cargar filtros"));
    }, []);

    // Espejo de los filtros y la pagina aplicados para recargas disparadas desde closures antiguos (intervalo, verificacion).
    const consultaRef = useRef<ConsultaCola>({ aplicados: FILTROS_INICIALES, pagina: 1 });
    // Solo la ultima peticion de la cola puede actualizar la tabla.
    const ultimaPeticionRef = useRef(0);
    // Cargas normales (no silenciosas) sin responder: mientras haya alguna, no se recarga en silencio.
    const cargasNormalesEnCursoRef = useRef(0);
    // Cita cuya vigencia se esta verificando; ignora pulsaciones repetidas en "Llamar".
    const verificandoRef = useRef<string | null>(null);
    // Candidatos ordenados para destacar la cita siguiente tras registrar una llamada.
    const candidatosSiguienteRef = useRef<string[] | null>(null);

    function prepararCitaSiguiente(idCitaActual: string) {
        const filasActuales = data?.filas ?? [];
        const idx = filasActuales.findIndex((f) => f.id_cita === idCitaActual);
        if (idx < 0) {
            candidatosSiguienteRef.current = null;
            return;
        }
        const candidatos = filasActuales.slice(idx + 1).map((f) => f.id_cita);
        if (idx > 0) {
            candidatos.push(filasActuales[idx - 1].id_cita);
        }
        candidatosSiguienteRef.current = candidatos;
    }

    const cargar = useCallback(async (opciones?: { silencioso?: boolean }) => {
        // La recarga silenciosa (refresco automatico) no muestra carga ni errores: si falla, conserva la cola.
        const silencioso = opciones?.silencioso ?? false;
        // Una recarga silenciosa nunca reemplaza a una carga normal pendiente: esa ya trae datos frescos.
        if (silencioso && cargasNormalesEnCursoRef.current > 0) return;
        const peticion = ++ultimaPeticionRef.current;
        const esVigente = () => peticion === ultimaPeticionRef.current;
        const { aplicados, pagina } = consultaRef.current;
        if (!silencioso) {
            cargasNormalesEnCursoRef.current += 1;
            setCargando(true);
            setErrorCola(null);
        }
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
            if (!esVigente()) return;
            if (!r.ok) {
                if (!silencioso) {
                    setErrorCola(r.error);
                    toast.error(r.error);
                }
                return;
            }
            setData(r.data);
            if (!silencioso && candidatosSiguienteRef.current !== null) {
                const idsNuevos = new Set(r.data.filas.map((f) => f.id_cita));
                const siguiente = candidatosSiguienteRef.current.find((id) => idsNuevos.has(id)) ?? null;
                setCitaSiguienteId(siguiente);
                candidatosSiguienteRef.current = null;
            }
            // Una recarga silenciosa exitosa usa la misma consulta que fallo antes: si tuvo exito, el
            // reintento funciono y ya no corresponde avisar que se muestra la ultima cola cargada.
            if (silencioso) setErrorCola(null);
        } catch {
            if (!esVigente() || silencioso) return;
            const mensaje = "Error al cargar la cola";
            setErrorCola(mensaje);
            toast.error(mensaje);
        } finally {
            if (!silencioso) {
                cargasNormalesEnCursoRef.current -= 1;
                // La carga se apaga cuando no queda ninguna carga normal pendiente, sea o no la vigente.
                if (cargasNormalesEnCursoRef.current === 0) setCargando(false);
            }
        }
    }, []);

    useEffect(() => {
        consultaRef.current = { aplicados, pagina };
        void cargar();
    }, [aplicados, pagina, cargar]);

    const [centros, setCentros] = useState<CentroOption[]>([]);
    const editarPaciente = useUsuarioEdit(() => void cargar());
    const hayModalAbierto = Boolean(citaSel || citaHistorial || citaOtras || editarPaciente.open);

    useRefrescoAutomatico(() => void cargar({ silencioso: true }), { pausado: hayModalAbierto });

    useEffect(() => {
        getCentros().then(setCentros).catch(() => toast.error("Error al cargar centros"));
    }, []);

    // Antes de llamar confirma que la cita sigue pendiente: otro funcionario pudo haberla cerrado
    // mientras la cola estaba abierta. Si la verificacion falla, se abre igual (el guardado vuelve a validar).
    async function abrirGestion(cita: CitaFila) {
        if (verificandoRef.current) return;
        verificandoRef.current = cita.id_cita;
        let pendiente = true;
        let estado: string | null = null;
        try {
            const r = await verificarCitaPendiente(cita.id_cita);
            if (r.ok) {
                pendiente = r.data.pendiente;
                estado = r.data.estado;
            }
        } catch {
            // Sin verificacion se abre igual.
        } finally {
            verificandoRef.current = null;
        }
        if (!pendiente) {
            toast.warning(estado ? `Esta cita ya fue cerrada (${estado})` : "Esta cita ya no está disponible en tu centro");
            // Si hay una carga normal pendiente (p. ej. filtros nuevos), esa ya traera la cola al dia.
            if (cargasNormalesEnCursoRef.current === 0) void cargar();
            return;
        }
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
                        <CardDescription>Ordenadas de mayor a menor prioridad.</CardDescription>
                    </div>
                    <PanelFiltros
                        descripcion="Filtra por temporalidad, estado, profesión, prestación, edad, fecha estimada, RUT y sector."
                        activos={contarFiltrosActivos(aplicados, [], FILTROS_INICIALES)}
                        activosDetalle={detalleFiltrosActivos(aplicados, opciones)}
                        onAplicar={() => {
                            candidatosSiguienteRef.current = null;
                            setCitaSiguienteId(null);
                            setPagina(1);
                            setAplicados(filtrosUI);
                        }}
                        onLimpiar={() => {
                            candidatosSiguienteRef.current = null;
                            setCitaSiguienteId(null);
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
                                <Button type="button" variant="outline" size="sm" disabled={cargando} onClick={() => void cargar()}>
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
                            citaSiguienteId={citaSiguienteId}
                            onPagina={(nuevaPagina) => {
                                candidatosSiguienteRef.current = null;
                                setCitaSiguienteId(null);
                                setPagina(nuevaPagina);
                            }}
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
                        prepararCitaSiguiente(citaSel.id_cita);
                        setCitaSel(null);
                        void cargar();
                    }}
                    onCitaCerrada={() => {
                        prepararCitaSiguiente(citaSel.id_cita);
                        setCitaSel(null);
                        void cargar();
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
