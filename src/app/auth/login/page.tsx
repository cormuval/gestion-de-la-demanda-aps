import { LockKeyhole } from "lucide-react";
import { signIn } from "@/auth";
// components
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card";

export default function LoginPage() {
    return (
        <main className="grid min-h-screen place-items-center bg-background px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                        <LockKeyhole size={20} />
                    </div>
                    <CardTitle>Ingreso al sistema</CardTitle>
                    <CardDescription>Accede con tu cuenta institucional de Google registrada como funcionario.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        action={async () => {
                            "use server";
                            await signIn("google", { redirectTo: "/solicitudes/ingresar" });
                        }}
                    >
                        <Button className="w-full" type="submit">
                            Ingresar con Google
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </main>
    );
}
