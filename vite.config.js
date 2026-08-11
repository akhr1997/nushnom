import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const FOURSQUARE_API_VERSION = "2025-06-17";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const foursquareApiKey = env.VITE_FOURSQUARE_API_KEY;

  return {
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      proxy: {
        "/api/foursquare": {
          target: "https://places-api.foursquare.com",
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/foursquare/, "/places"),
          headers: foursquareApiKey
            ? {
                Accept: "application/json",
                Authorization: `Bearer ${foursquareApiKey}`,
                "X-Places-Api-Version": FOURSQUARE_API_VERSION,
              }
            : undefined,
        },
      },
    },
  };
});
