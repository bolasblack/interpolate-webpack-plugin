import { Compiler, Compilation, sources } from 'webpack'

export { DefaultReplacer } from './DefaultReplacer'

export const PluginName = 'InterpolateWebpackPlugin'

export class InterpolateWebpackPlugin {
  private compiler?: Compiler

  constructor(private options: InterpolateWebpackPlugin.ConstructOptions) {}

  apply(compiler: Compiler): void {
    this.compiler = compiler
    compiler.hooks.emit.tapPromise(PluginName, this.compile)
  }

  private compile = async (compilation: Compilation): Promise<void> => {
    await Promise.all(
      Object.keys(compilation.assets).map(async (filename) => {
        const source = compilation.assets[filename]

        if (!source) return

        compilation.assets[filename] = await this.options.replacer(source, {
          filename,
          compiler: this.compiler!,
          compilation,
        })
      }),
    )
  }
}

export namespace InterpolateWebpackPlugin {
  export interface ReplacerContext {
    filename: string
    compiler: Compiler
    compilation: Compilation
  }

  export type Replacer = (
    content: sources.Source,
    context: ReplacerContext,
  ) => sources.Source | Promise<sources.Source>

  export interface ConstructOptions {
    replacer: Replacer
  }
}
