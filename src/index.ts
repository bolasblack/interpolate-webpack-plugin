import { Plugin, Compiler, compilation } from 'webpack'
import { Source } from 'webpack-sources'

export { DefaultReplacer } from './DefaultReplacer'

export const PluginName = 'InterpolateWebpackPlugin'

export class InterpolateWebpackPlugin implements Plugin {
  private compiler?: Compiler

  constructor(private options: InterpolateWebpackPlugin.ConstructOptions) {}

  apply(compiler: Compiler) {
    this.compiler = compiler

    // istanbul ignore else
    if ('hooks' in compiler) {
      compiler.hooks.emit.tapPromise(PluginName, this.compile)
    } else {
      ;(compiler as any).plugin(
        'emit',
        (compilation: compilation.Compilation, callback: () => void) => {
          this.compile(compilation).then(() => callback(), callback)
        },
      )
    }
  }

  private compile = async (compilation: compilation.Compilation) => {
    await Promise.all(
      Object.keys(compilation.assets).map(async filename => {
        const source: Source | undefined = compilation.assets[filename]

        // istanbul ignore next
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
    compilation: compilation.Compilation
  }

  export type Replacer = (
    content: Source,
    context: ReplacerContext,
  ) => Source | Promise<Source>

  export interface ConstructOptions {
    replacer: Replacer
  }
}
