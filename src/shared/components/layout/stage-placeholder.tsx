import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export function StagePlaceholder({ title, description }: { title: string; description: string }) {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Proxima etapa</CardTitle>
                    <CardDescription>La navegacion y el control de acceso ya estan preparados para este modulo.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Esta pantalla queda como punto de entrada para continuar el desarrollo.</p>
                </CardContent>
            </Card>
        </div>
    );
}
