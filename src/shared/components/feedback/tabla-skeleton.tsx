// components
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";

interface TablaSkeletonProps {
    columnas: number;
    filas?: number;
    etiqueta: string;
}

// Placeholder de la primera carga de una tabla: deja ver que se esta consultando sin saltos de layout.
export function TablaSkeleton({ columnas, filas = 6, etiqueta }: TablaSkeletonProps) {
    return (
        <div role="status" aria-live="polite" className="rounded-md border">
            <span className="sr-only">{etiqueta}</span>
            <Table aria-hidden="true">
                <TableHeader className="bg-muted">
                    <TableRow>
                        {Array.from({ length: columnas }, (_, i) => (
                            <TableHead key={i}>
                                <Skeleton className="h-4 w-20" />
                            </TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {Array.from({ length: filas }, (_, fila) => (
                        <TableRow key={fila}>
                            {Array.from({ length: columnas }, (_, col) => (
                                <TableCell key={col}>
                                    <Skeleton className="h-4 w-full max-w-40" />
                                    {col === 0 && <Skeleton className="mt-2 h-3 w-16" />}
                                </TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
