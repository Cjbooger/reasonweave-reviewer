export function runBufferedChildProcess(
  command: string,
  args: string[],
  options: {
    input: Buffer;
    cwd?: string;
    capture?: boolean;
    env?: NodeJS.ProcessEnv;
    maxBuffer?: number;
    timeout?: number;
  },
): { stdout: string; stderr: string };
