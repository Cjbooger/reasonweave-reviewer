import { spawnSync } from "node:child_process";

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function runBufferedChildProcess(
  command,
  args,
  {
    input,
    cwd,
    capture = false,
    env,
    maxBuffer = 10 * 1024 * 1024,
    timeout,
  } = {},
) {
  invariant(
    typeof command === "string" &&
      command.length > 0 &&
      Array.isArray(args) &&
      args.every((argument) => typeof argument === "string") &&
      Buffer.isBuffer(input) &&
      input.length > 0,
    "Buffered child-process input must be a non-empty Buffer with a valid command.",
  );

  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
    input,
    maxBuffer,
    stdio: capture ? "pipe" : ["pipe", "inherit", "inherit"],
    timeout,
  });

  if (result.error) {
    throw new Error(
      `Unable to run ${command}: ${result.error.code ?? result.error.message}`,
    );
  }
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr]
      .filter(Boolean)
      .join("\n")
      .trim();
    throw new Error(
      `${command} failed with status ${result.status}${detail ? `:\n${detail}` : ""}`,
    );
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
