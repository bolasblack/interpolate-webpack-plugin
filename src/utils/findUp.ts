import { Options } from 'find-up'

export async function findUp(
  name: string | readonly string[],
  options?: Options,
): Promise<undefined | string> {
  const { findUp } = await import('find-up')
  return findUp(name, options)
}
