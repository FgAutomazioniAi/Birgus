import { HttpServer } from "./HttpServer.js";

const server = new HttpServer();

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

server.start(port, host).catch((error) => {
  console.error("HTTP server startup failed.", error);
  process.exitCode = 1;
});
