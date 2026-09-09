import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { parseEnv, setEnvValues } from "./setup.js";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_PATH = join(ROOT, ".env");
const SECRETS_DIRECTORY = join(ROOT, "secrets");
const ACCESS_KEY_PATH = join(SECRETS_DIRECTORY, "brainyware_access_key");
const SECRET_KEY_PATH = join(SECRETS_DIRECTORY, "brainyware_secret_key");

async function ask(question: string, defaultValue?: string): Promise<string> {
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const suffix = defaultValue ? ` [${defaultValue}]` : "";
    return (await readline.question(`${question}${suffix}: `)).trim() || defaultValue || "";
  } finally {
    readline.close();
  }
}

async function askSecret(question: string, mayKeepExisting: boolean): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Il comando richiede un terminale interattivo.");
  }
  stdout.write(`${question}${mayKeepExisting ? " (Invio per conservare quella esistente)" : ""}: `);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  return new Promise<string>((resolvePromise, rejectPromise) => {
    let value = "";
    const finish = (): void => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
    };
    const onData = (chunk: string): void => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish();
          rejectPromise(new Error("Configurazione annullata: nessuna modifica applicata."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          resolvePromise(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " ") {
          value += character;
          stdout.write("*");
        }
      }
    };
    stdin.on("data", onData);
  });
}

function atomicWrite(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${value.trim()}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    renameSync(temporaryPath, path);
  } catch (error) {
    if (!existsSync(path)) throw error;
    rmSync(path);
    renameSync(temporaryPath, path);
  }
}

async function run(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { cwd: ROOT, shell: process.platform === "win32", stdio: "inherit" });
    child.once("error", rejectPromise);
    child.once("exit", (code) => code === 0 ? resolvePromise() : rejectPromise(new Error(`${command} terminato con codice ${code ?? -1}.`)));
  });
}

async function main(): Promise<void> {
  if (!existsSync(ENV_PATH)) throw new Error("File .env non trovato: eseguire prima npm run setup.");
  const envContent = readFileSync(ENV_PATH, "utf8");
  const currentBaseUrl = parseEnv(envContent).get("BRAINYWARE_BASE_URL")?.trim() || undefined;
  const baseUrl = await ask("URL base Brainyware (es. https://brainy.example.com)", currentBaseUrl);
  if (!baseUrl) throw new Error("L'URL base Brainyware e' obbligatorio.");
  const normalizedBaseUrl = new URL(baseUrl).toString().replace(/\/$/, "");

  const accessKeyExists = existsSync(ACCESS_KEY_PATH);
  const secretKeyExists = existsSync(SECRET_KEY_PATH);
  const accessKey = await askSecret("Access Key Brainyware", accessKeyExists);
  const secretKey = await askSecret("Secret Key Brainyware", secretKeyExists);
  if (!accessKey && !accessKeyExists) throw new Error("L'Access Key e' obbligatoria.");
  if (!secretKey && !secretKeyExists) throw new Error("La Secret Key e' obbligatoria.");

  if (accessKey) atomicWrite(ACCESS_KEY_PATH, accessKey);
  if (secretKey) atomicWrite(SECRET_KEY_PATH, secretKey);
  const updatedEnv = setEnvValues(envContent, new Map([
    ["BRAINYWARE_BASE_URL", normalizedBaseUrl],
    ["BRAINYWARE_ACCESS_KEY_SECRET_FILE", "./secrets/brainyware_access_key"],
    ["BRAINYWARE_SECRET_KEY_SECRET_FILE", "./secrets/brainyware_secret_key"],
  ]));
  atomicWrite(ENV_PATH, updatedEnv.trimEnd());

  stdout.write("\nCredenziali salvate come Docker Secrets. Ricreo il servizio applicativo...\n");
  await run("docker", ["compose", "up", "-d", "--build", "--force-recreate", "app"]);
  stdout.write("\nVerifico autenticazione e identita del service account...\n");
  await run("docker", ["compose", "exec", "-T", "app", "npm", "run", "brainyware:smoke:container"]);
  stdout.write("\nConfigurazione Brainyware completata.\n");
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : "Configurazione Brainyware non riuscita."}`);
  process.exitCode = 1;
});
