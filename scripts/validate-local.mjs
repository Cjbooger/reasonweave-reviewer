import { spawnSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const checks = [
  ["format:check", "Formatting"],
  ["verify", "Core code and fixture verification"],
  ["build", "Production build"],
  ["performance:bundle", "Bundle budgets"],
  ["test:e2e:no-key", "No-key browser journey"],
];

for (const [script, label] of checks) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(npm, ["run", script], {
    cwd: process.cwd(),
    stdio: "inherit",
  });

  if (result.error) {
    console.error(`Could not start ${script}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nPASS local no-cost validation gate");
