/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't bundle these for the browser; keep them as Node imports on the server.
  // Baileys + better-sqlite3 use Node-only APIs (fs, sockets, native binaries).
  serverExternalPackages: [
    "@whiskeysockets/baileys",
    "better-sqlite3",
  ],
};
export default nextConfig;
