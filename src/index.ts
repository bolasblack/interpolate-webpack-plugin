import { Plugin, Compiler } from 'webpack'
import { RawSource } from 'webpack-sources'
import { promisify } from 'util'
import isBinaryFile from 'isbinaryfile'
import fs from 'fs'
import findUp from 'find-up'
import execa from 'execa'
import flat from 'flat'
import escapeStringRegexp from 'escape-string-regexp'

type SndArgType<F extends (arg1: any, arg2: any, ...args: any[]) => any> = F extends (arg1: any, arg2: infer R, ...args: any[]) => any ? R : never

export const PluginName = 'InterpolateWebpackPlugin'

export type MatcherOption = boolean | string | RegExp | ((filePath: string) => boolean)

export interface InterpolateWebpackPluginOptionsReplacement {
  include?: MatcherOption[]
  exclude?: MatcherOption[]
  pattern: string | RegExp
  value: string | SndArgType<String['replace']>
}

export interface InterpolateWebpackPluginOptions {
  context?: string
  builtin?: {
    include?: MatcherOption[]
    exclude?: MatcherOption[]
  },
  replacements?: InterpolateWebpackPluginOptionsReplacement[],
}

export interface InterpolateWebpackPluginReplacement {
  include: (filePath: string) => boolean
  exclude: (filePath: string) => boolean
  pattern: InterpolateWebpackPluginOptionsReplacement['pattern']
  value: InterpolateWebpackPluginOptionsReplacement['value']
}

export class InterpolateWebpackPlugin implements Plugin {
  private options: InterpolateWebpackPluginOptions
  private compiler: Compiler
  private builtinInclude = (filePath: string) => true
  private builtinExclude = (filePath: string) =>
    filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.map')

  constructor(options?: InterpolateWebpackPluginOptions) {
    this.options = options || {}
    if (options && options.builtin) {
      if (options.builtin.include != null) {
        this.builtinInclude = this.transformAndCombineMatchers(options.builtin.include)
      }
      if (options.builtin.exclude != null) {
        this.builtinInclude = this.transformAndCombineMatchers(options.builtin.exclude)
      }
    }
  }

  apply(compiler: Compiler) {
    this.compiler = compiler

    compiler.hooks.emit.tapPromise(PluginName, async compilation => {
      const replacements = await this.getReplacements()

      Object.keys(compilation.assets).forEach(filename => {
        const relatedReplacements =  replacements.filter(r =>
          r.include(filename) && !r.exclude(filename)
        )

        if (!relatedReplacements.length) return

        const source: string | Buffer = compilation.assets[filename].source()

        if (typeof source !== 'string' && isBinaryFile.sync(source, source.length)) return

        const newSource = relatedReplacements.reduce((r, replacement) => {
          return r.replace(replacement.pattern, replacement.value as any)
        }, source.toString())

        compilation.assets[filename] = new RawSource(newSource)
      })
    })
  }

  private getReplacementsPromise?: Promise<InterpolateWebpackPluginReplacement[]>
  private getReplacements(): Promise<InterpolateWebpackPluginReplacement[]> {
    if (this.getReplacementsPromise) return this.getReplacementsPromise

    return this.getReplacementsPromise = (async () => {
      const userReplacements = this.toArray(this.options.replacements || []).map(r => ({
        ...r,
        include: this.transformAndCombineMatchers(r.include == null ? true : r.include),
        exclude: this.transformAndCombineMatchers(r.exclude == null ? false : r.exclude)
      }))

      const builtinReplacements = (await this.getBuiltinReplacements())
        .filter(r => r.value)
        .map(replacement => ({
          include: this.builtinInclude,
          exclude: this.builtinExclude,
          pattern: new RegExp(`%${escapeStringRegexp(replacement.pattern)}%`, 'g'),
          value: replacement.value,
        }))

      return userReplacements.concat(builtinReplacements)
    })()
  }

  public async getBuiltinReplacements() {
    const cwd = this.getContext()
    const [packageInfoReplacements, gitInfoReplacements] = await Promise.all([
      this.getPackageInfoReplacements(cwd),
      this.getGitInfoReplacements(cwd)
    ])
    return packageInfoReplacements.concat(gitInfoReplacements)
  }

  public async definePlugin() {
    return (await this.getBuiltinReplacements()).reduce<{ [key: string]: string }>((r, replacement) => {
      r[replacement.pattern] = `"${replacement.value}"`
      return r
    }, {})
  }

  private async getGitInfoReplacements(cwd: string) {
    const [gitDescribe, gitRev] = await Promise.all([
      execa('git', 'describe --tags'.split(' '), { cwd }).catch(() => null),
      execa('git', 'rev-parse --short HEAD'.split(' '), { cwd }).catch(() => null),
    ])

    const gitDescribeContent = gitDescribe && gitDescribe.code === 0 && String(gitDescribe.stdout).trim() || ''
    const gitRevContent = gitRev && gitRev.code === 0 && String(gitRev.stdout).trim() || ''

    const gitDescribeReplacement = {
      pattern: 'GIT_DESCRIBE',
      value: gitDescribeContent,
    }

    const gitRevReplacement = {
      pattern: 'GIT_REV',
      value: gitRevContent,
    }

    const gitVersionReplacement = {
      pattern: 'GIT_VERSION',
      value: gitDescribeContent || gitRevContent,
    }

    return [gitDescribeReplacement, gitRevReplacement, gitVersionReplacement]
  }

  private async getPackageInfoReplacements(cwd: string) {
    let pkgFilePath: string | null = null
    try {
      pkgFilePath = await findUp('package.json', { cwd })
    } catch {}
    if (!pkgFilePath) return []

    let packageJson: any
    try {
      const packageJsonContent = await promisify(fs.readFile)(pkgFilePath)
      packageJson = JSON.parse(packageJsonContent.toString())
    } catch {
      return []
    }

    const packageInfo = flat({ packageJson })
    return Object.keys(packageInfo).map(key => ({
      pattern: key,
      value: String(packageInfo[key]),
    }))
  }

  private toArray<T>(obj: T | T[]) {
    return Array.isArray(obj) ? obj : [obj]
  }

  private transformAndCombineMatchers(matcherOptions: MatcherOption | MatcherOption[]) {
    if (Array.isArray(matcherOptions)) {
      const matchers = matcherOptions.map(this.toMatcher)
      return (filePath: string) => matchers.every(matcher => matcher(filePath))
    } else {
      return this.toMatcher(matcherOptions)
    }
  }

  private toMatcher(val: MatcherOption): (filePath: string) => boolean {
    if (val instanceof RegExp) return str => val.test(str)
    if (typeof val === 'string') return str => str.includes(val)
    if (typeof val === 'function') return val
    return _ => val
  }

  private getContext() {
    return (this.options && this.options.context) ||
           (this.compiler && this.compiler.options.context) ||
           process.cwd()
  }
}
