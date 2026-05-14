import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function resolveCommand(command) {
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

export function run(command, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const resolvedCommand = resolveCommand(command);
    const isWindowsCmd = process.platform === "win32" && /\.(bat|cmd)$/i.test(resolvedCommand);
    const childCommand = isWindowsCmd ? (process.env.ComSpec || "cmd.exe") : resolvedCommand;
    const childArgs = isWindowsCmd ? ["/d", "/c", resolvedCommand, ...args] : args;
    const child = spawn(childCommand, childArgs, {
      cwd: options.cwd ?? process.cwd(),
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.stdio ?? "inherit",
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} terminated by signal ${signal}`));
        return;
      }

      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });

    child.on("error", reject);
  });
}

export async function runAll(steps) {
  for (const step of steps) {
    await run(step.command, step.args, step.options);
  }
}
