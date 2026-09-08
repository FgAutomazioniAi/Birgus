import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const ROOT = resolve(import.meta.dirname, "..");
const ENV_PATH = join(ROOT, ".env");
const ENV_EXAMPLE_PATH = join(ROOT, ".env.example");
const GARAGE_CONFIG_PATH = join(ROOT, "garage", "garage.local.toml");
const GARAGE_EXAMPLE_PATH = join(ROOT, "garage", "garage.toml.example");
const TOTAL_STEPS = 8;
const MODULE_KEYS = [
  "project_management",
  "agent_management",
  "ddt_processing",
  "measure_report",
  "document_archive",
  "document_intelligence",
  "conversational_assistant",
  "ai_runtime_control",
  "workflow_management",
  "commission_registry",
  "commission_intake",
  "customer_map",
  "offer_priority",
  "maintenance_proposals",
  "maintenance_calendar",
  "notification_center",
  "audit_center",
  "superadmin_center",
] as const;

type SetupAnswers = {
  organizationName: string;
  organizationCode: string;
  workspaceName: string;
  workspaceCode: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  httpPort: string;
  aiBaseUrl: string;
  aiModel: string;
  aiApiKey: string;
  garageCapacity: string;
};

type CommandResult = {
  code: number;
  output: string;
};

function heading(title: string): void {
  stdout.write(`\n${title}\n${"=".repeat(title.length)}\n`);
}

function step(number: number, message: string): void {
  stdout.write(`\n[${number}/${TOTAL_STEPS}] ${message}\n`);
}

function generatedHex(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

function generatedToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function isPlaceholder(value: string | undefined): boolean {
  return !value || value.includes("CHANGE_ME") || value.includes("REPLACE_WITH");
}

export function parseEnv(content: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

export function setEnvValues(content: string, values: Map<string, string>): string {
  const pending = new Map(values);
  const lines = content.split(/\r?\n/).map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match || !pending.has(match[1])) return line;
    const value = pending.get(match[1]) ?? "";
    pending.delete(match[1]);
    return `${match[1]}=${value}`;
  });
  if (pending.size > 0) {
    lines.push("", "# Added by the interactive setup");
    for (const [key, value] of pending) lines.push(`${key}=${value}`);
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function setTomlValue(content: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}\\s*=.*$`, "m");
  if (!pattern.test(content)) throw new Error(`Garage template is missing '${key}'.`);
  return content.replace(pattern, `${key} = "${value}"`);
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.setup-${process.pid}.tmp`;
  writeFileSync(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
  try {
    renameSync(temporaryPath, path);
  } catch (error) {
    if (!existsSync(path)) throw error;
    rmSync(path);
    renameSync(temporaryPath, path);
  }
}

async function ask(question: string, defaultValue?: string): Promise<string> {
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  const readline = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await readline.question(prompt)).trim();
    return answer || defaultValue || "";
  } finally {
    readline.close();
  }
}

async function askRequired(question: string, defaultValue?: string): Promise<string> {
  while (true) {
    const answer = await ask(question, defaultValue);
    if (answer) return answer;
    stdout.write("Il valore e' obbligatorio.\n");
  }
}

async function askYesNo(question: string, defaultYes: boolean): Promise<boolean> {
  const suffix = defaultYes ? "S/n" : "s/N";
  while (true) {
    const answer = (await ask(`${question} (${suffix})`)).toLowerCase();
    if (!answer) return defaultYes;
    if (["s", "si", "y", "yes"].includes(answer)) return true;
    if (["n", "no"].includes(answer)) return false;
    stdout.write("Rispondere con si o no.\n");
  }
}

async function askSecret(question: string, optional = false): Promise<string> {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Il setup interattivo richiede un terminale TTY.");
  }
  stdout.write(`${question}${optional ? " (facoltativo)" : ""}: `);
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
          rejectPromise(new Error("Installazione annullata."));
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

export function slug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

export function validCode(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,62}$/.test(value);
}

export function nextGarageLayoutVersion(output: string): string | null {
  const instructedVersion = output.match(/layout apply(?:\s+|\s+.*\s+)--version(?:=|\s+)(\d+)/i)?.[1];
  if (instructedVersion) return instructedVersion;
  const stagedVersion = output.match(/staged(?: cluster)? layout version\s*:\s*(\d+)/i)?.[1];
  if (stagedVersion) return stagedVersion;
  const currentVersion = output.match(/current(?: cluster)? layout version\s*:\s*(\d+)/i)?.[1];
  return currentVersion === undefined ? null : String(Number(currentVersion) + 1);
}

async function askCode(question: string, suggested: string): Promise<string> {
  while (true) {
    const answer = (await askRequired(question, suggested)).toLowerCase();
    if (validCode(answer)) return answer;
    stdout.write("Usare da 2 a 63 caratteri: lettere minuscole, numeri e trattini.\n");
  }
}

async function askEmail(): Promise<string> {
  while (true) {
    const answer = (await askRequired("Email del Developer")).toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer)) return answer;
    stdout.write("Inserire un indirizzo email valido.\n");
  }
}

async function askPassword(): Promise<string> {
  while (true) {
    const password = await askSecret("Password temporanea del Developer");
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      stdout.write("Servono almeno 8 caratteri, una maiuscola e un numero.\n");
      continue;
    }
    const confirmation = await askSecret("Ripetere la password");
    if (password === confirmation) return password;
    stdout.write("Le password non coincidono.\n");
  }
}

async function askPort(defaultValue: string): Promise<string> {
  while (true) {
    const value = await askRequired("Porta HTTP pubblica", defaultValue);
    const port = Number(value);
    if (Number.isInteger(port) && port >= 1 && port <= 65535) return String(port);
    stdout.write("Inserire una porta compresa tra 1 e 65535.\n");
  }
}

async function askCapacity(defaultValue: string): Promise<string> {
  while (true) {
    const value = (await askRequired("Capacita' assegnata a Garage", defaultValue)).toUpperCase();
    if (/^[1-9]\d*(?:\.\d+)?(?:MB|GB|TB)$/.test(value)) return value;
    stdout.write("Usare un valore come 10GB, 500GB o 1TB.\n");
  }
}

async function collectAnswers(existing: Map<string, string>): Promise<SetupAnswers> {
  const organizationName = await askRequired("Nome dell'organizzazione");
  const organizationCode = await askCode("Codice organizzazione", slug(organizationName) || "azienda");
  const workspaceName = await askRequired("Nome del workspace", organizationName);
  const workspaceCode = await askCode("Codice workspace", slug(workspaceName) || "principale");
  const firstName = await askRequired("Nome del Developer");
  const lastName = await ask("Cognome del Developer (facoltativo)");
  const email = await askEmail();
  const password = await askPassword();
  const httpPort = await askPort(existing.get("BIRGUS_HOST_HTTP_PORT") || "80");
  const aiBaseUrl = await askRequired(
    "URL del provider AI compatibile OpenAI",
    existing.get("AI_PROVIDER_BASE_URL") || "http://internal-ai-vllm:8000/v1",
  );
  const aiModel = await askRequired("Nome del modello AI", existing.get("AI_PROVIDER_CHAT_MODEL") || "birgus-vl");
  const aiApiKey = await askSecret("API key del provider AI", true);
  const garageCapacity = await askCapacity("10GB");
  return {
    organizationName,
    organizationCode,
    workspaceName,
    workspaceCode,
    firstName,
    lastName,
    email,
    password,
    httpPort,
    aiBaseUrl,
    aiModel,
    aiApiKey,
    garageCapacity,
  };
}

function runCommand(
  command: string,
  args: string[],
  options: { capture?: boolean; input?: string; allowFailure?: boolean } = {},
): Promise<CommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      shell: false,
      stdio: options.capture || options.input !== undefined ? ["pipe", "pipe", "pipe"] : "inherit",
    });
    let output = "";
    if (child.stdout) child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    if (child.stderr) child.stderr.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      const exitCode = code ?? 1;
      if (exitCode !== 0 && !options.allowFailure) {
        rejectPromise(new Error(output.trim() || `${command} exited with code ${exitCode}.`));
        return;
      }
      resolvePromise({ code: exitCode, output });
    });
    if (child.stdin) {
      if (options.input !== undefined) child.stdin.end(options.input);
      else child.stdin.end();
    }
  });
}

async function dockerCompose(args: string[], options: Parameters<typeof runCommand>[2] = {}): Promise<CommandResult> {
  return runCommand("docker", ["compose", ...args], options);
}

async function verifyRequirements(): Promise<void> {
  await runCommand("docker", ["version"], { capture: true });
  await dockerCompose(["version"], { capture: true });
}

function prepareConfiguration(answers: SetupAnswers, existingContent: string): {
  envContent: string;
  garageContent: string;
  values: Map<string, string>;
} {
  const template = existingContent || readFileSync(ENV_EXAMPLE_PATH, "utf8");
  const existing = parseEnv(template);
  const secret = (key: string, factory: () => string): string => {
    const value = existing.get(key);
    return isPlaceholder(value) ? factory() : value!;
  };
  const values = new Map<string, string>([
    ["AUTH_PEPPER", secret("AUTH_PEPPER", () => generatedHex())],
    ["AUTH_TOTP_ENCRYPTION_KEY", secret("AUTH_TOTP_ENCRYPTION_KEY", () => generatedHex())],
    ["GARAGE_RPC_SECRET", secret("GARAGE_RPC_SECRET", () => generatedHex())],
    ["GARAGE_ADMIN_TOKEN", secret("GARAGE_ADMIN_TOKEN", () => generatedToken())],
    ["GARAGE_METRICS_TOKEN", secret("GARAGE_METRICS_TOKEN", () => generatedToken())],
    ["GARAGE_S3_ACCESS_KEY_ID", secret("GARAGE_S3_ACCESS_KEY_ID", () => `GK${generatedHex(12)}`)],
    ["GARAGE_S3_SECRET_ACCESS_KEY", secret("GARAGE_S3_SECRET_ACCESS_KEY", () => generatedHex())],
    ["OCR_LIFECYCLE_TOKEN", secret("OCR_LIFECYCLE_TOKEN", () => generatedToken())],
    ["BIRGUS_HOST_HTTP_PORT", answers.httpPort],
    ["AI_PROVIDER_BASE_URL", answers.aiBaseUrl],
    ["AI_PROVIDER_CHAT_MODEL", answers.aiModel],
    ["AI_PROVIDER_API_KEY", answers.aiApiKey || existing.get("AI_PROVIDER_API_KEY") || ""],
    ["GARAGE_S3_BUCKET", existing.get("GARAGE_S3_BUCKET") || "birgus-files"],
  ]);
  let garageContent = existsSync(GARAGE_CONFIG_PATH)
    ? readFileSync(GARAGE_CONFIG_PATH, "utf8")
    : readFileSync(GARAGE_EXAMPLE_PATH, "utf8");
  garageContent = setTomlValue(garageContent, "rpc_secret", values.get("GARAGE_RPC_SECRET")!);
  garageContent = setTomlValue(garageContent, "admin_token", values.get("GARAGE_ADMIN_TOKEN")!);
  garageContent = setTomlValue(garageContent, "metrics_token", values.get("GARAGE_METRICS_TOKEN")!);
  return { envContent: setEnvValues(template, values), garageContent, values };
}

function backupExistingConfiguration(): string | null {
  if (!existsSync(ENV_PATH) && !existsSync(GARAGE_CONFIG_PATH)) return null;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDirectory = join(ROOT, "backups", `setup-${timestamp}`);
  mkdirSync(backupDirectory, { recursive: true });
  if (existsSync(ENV_PATH)) copyFileSync(ENV_PATH, join(backupDirectory, ".env"));
  if (existsSync(GARAGE_CONFIG_PATH)) copyFileSync(GARAGE_CONFIG_PATH, join(backupDirectory, "garage.local.toml"));
  return backupDirectory;
}

async function configureGarage(values: Map<string, string>, capacity: string): Promise<void> {
  const status = await dockerCompose(["exec", "-T", "garage", "/garage", "status"], { capture: true });
  const nodeId = status.output.match(/^([0-9a-f]{16})\s+/m)?.[1];
  if (!nodeId) throw new Error("Impossibile rilevare l'identificativo del nodo Garage.");

  const nodeStatusLine = status.output.match(new RegExp(`^${nodeId}\\s+.*$`, "m"))?.[0] ?? "";
  const nodeHasRole = !nodeStatusLine.includes("NO ROLE ASSIGNED")
    && /\s(?:MB|GB|TB)\s/.test(nodeStatusLine);
  if (!nodeHasRole) {
    await dockerCompose([
      "exec", "-T", "garage", "/garage", "layout", "assign", nodeId,
      "--zone", "local", "--capacity", capacity,
    ], { capture: true });
    const stagedLayout = await dockerCompose(
      ["exec", "-T", "garage", "/garage", "layout", "show"],
      { capture: true },
    );
    const version = nextGarageLayoutVersion(stagedLayout.output);
    if (!version) throw new Error(`Garage non ha restituito una versione di layout riconoscibile.\n${stagedLayout.output}`);
    await dockerCompose(["exec", "-T", "garage", "/garage", "layout", "apply", "--version", version]);
  }

  const keyId = values.get("GARAGE_S3_ACCESS_KEY_ID")!;
  const secretKey = values.get("GARAGE_S3_SECRET_ACCESS_KEY")!;
  const bucket = values.get("GARAGE_S3_BUCKET")!;
  const keyInfo = await dockerCompose(["exec", "-T", "garage", "/garage", "key", "info", keyId], {
    capture: true,
    allowFailure: true,
  });
  if (keyInfo.code !== 0) {
    await dockerCompose(["exec", "-T", "garage", "/garage", "key", "import", keyId, secretKey, "--yes"], { capture: true });
  }
  const bucketInfo = await dockerCompose(["exec", "-T", "garage", "/garage", "bucket", "info", bucket], {
    capture: true,
    allowFailure: true,
  });
  if (bucketInfo.code !== 0) {
    await dockerCompose(["exec", "-T", "garage", "/garage", "bucket", "create", bucket]);
  }
  await dockerCompose([
    "exec", "-T", "garage", "/garage", "bucket", "allow",
    "--read", "--write", "--owner", bucket, "--key", keyId,
  ]);
}

async function initializeInstance(answers: SetupAnswers): Promise<void> {
  const args = [
    "exec", "-T", "app", "npm", "run", "instance:initialize", "--",
    "--organization-code", answers.organizationCode,
    "--organization-name", answers.organizationName,
    "--workspace-code", answers.workspaceCode,
    "--workspace-name", answers.workspaceName,
    "--email", answers.email,
    "--first-name", answers.firstName,
    "--password-stdin",
    "--modules", MODULE_KEYS.join(","),
  ];
  if (answers.lastName) args.push("--last-name", answers.lastName);
  await dockerCompose(args, { input: `${answers.password}\n` });
}

async function main(): Promise<void> {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log("Uso: npm run setup\n\nConfigura e avvia una nuova installazione Birgus.");
    return;
  }
  if (!stdin.isTTY || !stdout.isTTY) throw new Error("Eseguire npm run setup da un terminale interattivo.");

  heading("Installazione guidata Birgus");
  stdout.write("Il programma prepara la configurazione, avvia Docker e crea il primo account Developer.\n");

  const existingContent = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  if (existingContent || existsSync(GARAGE_CONFIG_PATH)) {
    stdout.write("\nSono presenti configurazioni locali. Potrebbe trattarsi di un'installazione esistente o interrotta.\n");
    const resume = await askYesNo("Creare un backup e continuare usando i segreti esistenti", false);
    if (!resume) {
      stdout.write("Installazione annullata senza modifiche.\n");
      return;
    }
  }

  step(1, "Verifica dei requisiti");
  await verifyRequirements();
  stdout.write("Docker Engine e Docker Compose sono disponibili.\n");

  step(2, "Raccolta dei dati iniziali");
  const answers = await collectAnswers(parseEnv(existingContent));
  stdout.write(`\nOrganizzazione: ${answers.organizationName} (${answers.organizationCode})\n`);
  stdout.write(`Workspace: ${answers.workspaceName} (${answers.workspaceCode})\n`);
  stdout.write(`Developer: ${answers.firstName}${answers.lastName ? ` ${answers.lastName}` : ""} <${answers.email}>\n`);
  stdout.write(`Provider AI: ${answers.aiBaseUrl} - ${answers.aiModel}\n`);
  if (!(await askYesNo("Confermare e iniziare l'installazione", true))) {
    stdout.write("Installazione annullata senza modifiche.\n");
    return;
  }

  step(3, "Generazione della configurazione e dei segreti");
  const configuration = prepareConfiguration(answers, existingContent);
  const backupDirectory = backupExistingConfiguration();
  atomicWrite(ENV_PATH, configuration.envContent);
  atomicWrite(GARAGE_CONFIG_PATH, configuration.garageContent);
  for (const [key, value] of parseEnv(configuration.envContent)) process.env[key] = value;
  stdout.write("Configurazione salvata. I segreti non vengono mostrati a schermo.\n");
  if (backupDirectory) stdout.write(`Backup precedente: ${backupDirectory}\n`);

  step(4, "Validazione della configurazione Docker");
  await dockerCompose(["config", "--quiet"]);

  step(5, "Build delle immagini Docker");
  await dockerCompose(["build", "--progress", "plain"]);

  step(6, "Avvio di PostgreSQL e Garage");
  await dockerCompose(["up", "-d", "--wait", "--wait-timeout", "300", "postgres", "garage"]);
  await configureGarage(configuration.values, answers.garageCapacity);
  stdout.write("Garage e lo spazio oggetti sono configurati.\n");

  step(7, "Avvio e controllo dei servizi Birgus");
  await dockerCompose(["up", "-d", "--wait", "--wait-timeout", "900"]);
  await dockerCompose(["ps"]);

  step(8, "Creazione del workspace e del Developer");
  await initializeInstance(answers);

  heading("Installazione completata");
  stdout.write(`Aprire http://localhost:${answers.httpPort}\n`);
  stdout.write(`Accedere con ${answers.email}. Al primo accesso saranno richiesti cambio password e configurazione 2FA.\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(`\nInstallazione non completata: ${error instanceof Error ? error.message : String(error)}`);
    console.error("Le configurazioni gia' scritte sono state conservate. Correggere il problema e rieseguire npm run setup.");
    process.exitCode = 1;
  });
}
