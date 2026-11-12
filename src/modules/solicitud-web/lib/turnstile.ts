export async function verificarCaptcha(token: string, ip: string | null): Promise<boolean> {
    const secreto = process.env.TURNSTILE_SECRET_KEY;
    if (!secreto || !token.trim() || token.length > 2048) return false;

    const cuerpo = new URLSearchParams({ secret: secreto, response: token });
    if (ip) cuerpo.set("remoteip", ip);

    try {
        const respuesta = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
            method: "POST",
            body: cuerpo,
            signal: AbortSignal.timeout(5_000),
        });
        const resultado: unknown = await respuesta.json();
        return typeof resultado === "object" && resultado !== null
            && "success" in resultado && resultado.success === true;
    } catch {
        return false;
    }
}
