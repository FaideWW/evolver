import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import path from "path";

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "./src/game/core"),
      "@resources": path.resolve(__dirname, "./src/game/resources"),
      "@components": path.resolve(__dirname, "./src/components"),
    },
  },
});
