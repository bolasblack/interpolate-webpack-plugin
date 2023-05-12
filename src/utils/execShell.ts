import { ExecaReturnValue, Options } from 'execa'

export async function execShell(
  file: string,
  args: readonly string[],
  options?: Options,
): Promise<ExecaReturnValue> {
  const { execa } = await import('execa')
  return execa(file, args, options)
}
