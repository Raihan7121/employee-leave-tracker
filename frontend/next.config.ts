import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Bundles the server and only the dependencies actually imported into
  // .next/standalone, so the Docker runtime stage can copy that one folder and
  // skip node_modules entirely.
  output: "standalone",
}

export default nextConfig
