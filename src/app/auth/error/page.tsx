import Link from "next/link";
// components
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export default function AuthErrorPage() {
    return (
        <main className="grid min-h-screen place-items-center bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>No se pudo iniciar sesion</CardTitle>
                    <CardDescription>Tu cuenta no esta habilitada como funcionario activo o hubo un problema con Google.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full">
                        <Link href="/auth/login">Volver a intentar</Link>
                    </Button>
                </CardContent>
            </Card>
        </main>
    );
}
