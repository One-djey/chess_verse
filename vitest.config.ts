import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Config dédiée aux tests, séparée de vite.config.ts pour ne pas
// embarquer le plugin PWA dans l'environnement de test.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    // Les tests de composants (*.test.tsx) déclarent leur environnement via
    // le docblock `// @vitest-environment jsdom` en tête de fichier.
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/types/**"],
      reporter: ["text", "html"],
      // Seuils appliqués aux modules P0 (logique chess pure + stats).
      thresholds: {
        "src/utils/chess/castling.ts": { lines: 100, functions: 100, branches: 100 },
        "src/utils/chess/moves.ts": { lines: 90, functions: 90, branches: 85 },
        "src/utils/chess/assimilation.ts": { lines: 100, functions: 100, branches: 90 },
        "src/utils/chess/aiFallback.ts": { lines: 90, functions: 90, branches: 85 },
        "src/utils/chess/board.ts": { lines: 90, functions: 90, branches: 85 },
        "src/services/statsService.ts": { lines: 85, functions: 85, branches: 80 },
        "src/utils/pieceImage.ts": { lines: 100, functions: 100, branches: 100 },
      },
    },
  },
});
