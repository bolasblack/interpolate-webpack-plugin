declare module 'isbinaryfile' {
  type Callback = (err: Error | null, isBinaryFile: boolean) => void

  function isBinaryFile(filepath: string, callback: Callback): void
  function isBinaryFile(bytes: Buffer, size: number, callback: Callback): void

  namespace isBinaryFile {
    export function sync(filepath: string): boolean
    export function sync(bytes: Buffer, size: number): boolean
  }

  export default isBinaryFile
}
