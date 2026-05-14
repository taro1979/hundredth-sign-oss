#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const separatorIndex = process.argv.indexOf("--", 2);

if (separatorIndex === -1 || separatorIndex === process.argv.length - 1) {
  console.error("Usage: node scripts/run-with-env.mjs KEY=value [KEY=value ...] -- command [args...]");
  process.exit(1);
}

const envEntries = process.argv.slice(2, separatorIndex);
const commandAndArgs = process.argv.slice(separatorIndex + 1);
const env = { ...process.env };

for (const entry of envEntries) {
  const equalsIndex = entry.indexOf("=");
  if (equalsIndex <= 0) {
    console.error(`Invalid environment assignment: ${entry}`);
    process.exit(1);
  }

  env[entry.slice(0, equalsIndex)] = entry.slice(equalsIndex + 1);
}

function resolveCommand(command) {
  if (command.includes("/") || command.includes("\\")) return command;

  const pathEntries = [
    path.join(process.cwd(), "node_modules", ".bin"),
    ...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean),
  ];
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")
    : [""];

  for (const dir of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(dir, command + extension.toLowerCase());
      if (fs.existsSync(candidate)) return candidate;
      const upperCandidate = path.join(dir, command + extension.toUpperCase());
      if (fs.existsSync(upperCandidate)) return upperCandidate;
    }
  }

  return command;
}

const resolvedCommand = resolveCommand(commandAndArgs[0]);
const commandArgs = commandAndArgs.slice(1);

const isWindowsCmd = process.platform === "win32" && /\.(bat|cmd)$/i.test(resolvedCommand);
const childCommand = isWindowsCmd ? (process.env.ComSpec || "cmd.exe") : resolvedCommand;
const childArgs = isWindowsCmd ? ["/d", "/c", resolvedCommand, ...commandArgs] : commandArgs;
const child = spawn(childCommand, childArgs, {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", error => {
  console.error(error);
  process.exit(1);
});
