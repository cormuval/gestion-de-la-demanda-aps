"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
// actions
import { getCitasPendientes, CitaFila } from "@/modules/comunicador/actions/getCitasPendientes.action";
import { getFiltrosComunicador } from "@/modules/comunicador/actions/getFiltrosComunicador.action";
import { getContactoPaciente } from "@/modules/comunicador/actions/getContactoPaciente.action";
import { getCentros, type CentroOption } from "@/modules/solicitudes/actions/getCentros.action";
// components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { CitasFiltros, CitasFiltrosUI, FILTROS_INICIALES } from "@/modules/comunicador/components/CitasFiltros";
import { CitasPendientesTabla } from "@/modules/comunicador/components/CitasPendientesTabla";
import { RegistrarLlamadaModal } from "@/modules/comunicador/components/RegistrarLlamadaModal";
import { CitaAccionesMenu } from "@/modules/comunicador/components/CitaAccionesMenu";
import { HistorialLlamadasModal } from "@/modules/comunicador/components/HistorialLlamadasModal";
import { OtrasCitasPacienteModal } from "@/modules/comunicador/components/OtrasCitasPacienteModal";
import { UsuarioEditModal } from "@/modules/solicitudes/components/UsuarioEditModal";
// hooks
import { useUsuarioEdit } from "@/modules/comunicador/hooks/useUsuarioEdit";

type Opciones = Awaited<ReturnType<typeof getFiltrosComunicador>>;

export default function ComunicadorPage() {
    const [opciones, setOpciones] = useState<Opciones>({ profesionales: [], prestaciones: [] });
    const [filtrosUI, setFiltrosUI] = useState<CitasFiltrosUI>(FILTROS_INICIALES);
    const [aplicados, setAplicados] = useState<CitasFiltrosUI>(FILTROS_INICIALES);
    const [pagina, setPagina] = useState(1);
    const [data, setData] = useState<{ filas: CitaFila[]; total: number; pagina: number; porPagina: number }>({ filas: [], total: 0, pagina: 1, porPagina: 100 });
    const [citaSel, setCitaSel] = useState<CitaFila | null>(null);
    const [contacto, setContacto] = useState<{ telefonos: string; correo: string }>({ telefonos: "", correo: "" });
    const [citaHistorial, setCitaHistorial] = useState<CitaFila | null>(null);
    const [citaOtras, setCitaOtras] = useState<CitaFila | null>(null);

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
                rut: aplicados.rut || undefined,
                sector: aplicados.sector || undefined,
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

    const [centros, setCentros] = useState<CentroOption[]>([]);
    const editarPaciente = useUsuarioEdit(cargar);

    useEffect(() => {
        getCentros().then(setCentros).catch((e) => toast.error(e instanceof Error ? e.message : "Error al cargar centros"));
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
                <h1 className="text-2xl font-semibold tracking-normal">Comunicador</h1>
                <p className="mt-1 text-sm text-muted-foreground">Gestión de citaciones pendientes: registra llamadas y cierra citas.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Filtros</CardTitle>
                    <CardDescription>Filtra por temporalidad, estado, profesión, prestación, edad, fecha estimada, RUT y sector.</CardDescription>
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
                        renderAcciones={(cita) => (
                            <CitaAccionesMenu
                                cita={cita}
                                onVerHistorial={setCitaHistorial}
                                onVerOtrasCitas={setCitaOtras}
                                onEditarPaciente={(c) => editarPaciente.abrir(c.rut_usuario)}
                            />
                        )}
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
