import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

interface Finding {
  file: string;
  message: string;
}

const requiredFiles = [
  ".github/CODEOWNERS",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/workflows/secure-development.yml",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/APPROVED_LIBRARIES.md",
  "docs/CODING_STYLE_SECURITY.md",
  "docs/HTTPS_FINAL_STEP.md",
  "docs/SECURITY_EXCEPTION_TEMPLATE.md",
];

const skippedFilePatterns = [
  /^package-lock\.json$/,
  /^frontend\/package-lock\.json$/,
  /^garage\/garage\.toml\.example$/,
];

const findings: Finding[] = [];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    findings.push({ file, message: "Required governance/security file is missing." });
  }
}

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split("\n")
  .map((item) => item.trim())
  .filter(Boolean);

for (const file of trackedFiles) {
  if (!existsSync(file)) {
    continue;
  }

  if (skippedFilePatterns.some((pattern) => pattern.test(file))) {
    continue;
  }

  if (/(^|\/)\.env(\.|$)/.test(file)) {
    findings.push({ file, message: "Environment files must not be tracked." });
    continue;
  }

  if (file === "garage/garage.toml" || file === "garage/garage.local.toml" || file === "Caddyfile.https.local") {
    findings.push({ file, message: "Runtime config with secrets or local hostnames must not be tracked." });
    continue;
  }

  const content = readFileSync(file, "utf8");
  const checks: Array<[RegExp, string]> = [
    [/rpc_secret\s*=\s*"(?!REPLACE_WITH_64_HEX_CHARS)[^"]{16,}"/, "Garage rpc_secret appears to be hardcoded."],
    [/admin_token\s*=\s*"(?!REPLACE_WITH_RANDOM_ADMIN_TOKEN)[^"]{16,}"/, "Garage admin_token appears to be hardcoded."],
    [/metrics_token\s*=\s*"(?!REPLACE_WITH_RANDOM_METRICS_TOKEN)[^"]{16,}"/, "Garage metrics_token appears to be hardcoded."],
    [/password\s*:\s*["']admin["']/, "Hardcoded admin password detected."],
    [/setCreatePassword\(["']admin["']\)/, "Superadmin UI must not default to admin password."],
  ];

  for (const [pattern, message] of checks) {
    if (pattern.test(content)) {
      findings.push({ file, message });
    }
  }
}

if (findings.length > 0) {
  console.error("Security policy check failed:");
  for (const finding of findings) {
    console.error(`- ${finding.file}: ${finding.message}`);
  }
  process.exit(1);
}

console.log("Security policy check passed.");
