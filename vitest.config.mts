import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        // Los worktrees locales viven en .claude/ y no deben correr con este proyecto.
        exclude: [...configDefaults.exclude, ".claude/**"]
    }
});
