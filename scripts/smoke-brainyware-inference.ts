import { BrainywareClient } from "../src/modules/brainyware/services/BrainywareClient.js";

async function main(): Promise<void> {
  const client = new BrainywareClient();
  if (!await client.isConfigured()) throw new Error("Brainyware non configurato nel container app.");

  const [models, connections] = await Promise.all([
    client.listModels(),
    client.listDatabaseConnections(),
  ]);
  console.log(`Catalogo Brainyware: ${models.length} modello/i, ${connections.length} database.`);

  if (models[0]) {
    const result = await client.inferStateless({
      mode: "model",
      model: models[0].id,
      message: "Rispondi esclusivamente con OK.",
      maxTokens: 256,
    });
    console.log(`Inferenza modello: OK (${result.reply.length} caratteri, sessione persistente: no).`);
  }

  if (connections[0]) {
    const result = await client.inferStateless({
      mode: "database",
      connectionId: connections[0].id,
      message: "Rispondi esclusivamente con OK senza eseguire query sul database.",
      instructions: "Non consultare tabelle o dati per questo controllo tecnico.",
    });
    console.log(`Inferenza database: OK (${result.reply.length} caratteri, sessione persistente: no).`);
  }

  if (models.length === 0 && connections.length === 0) {
    throw new Error("Il service account Brainyware non vede modelli o database.");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Errore Brainyware non riconosciuto.";
  console.error(`Smoke test inferenza Brainyware fallito: ${message}`);
  process.exitCode = 1;
});
