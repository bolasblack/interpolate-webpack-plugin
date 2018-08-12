import { Plugin, Compiler } from 'webpack'
import { Hooks as HtmlWebpackPluginHooks } from 'html-webpack-plugin'
import { promisify, inspect } from 'util'
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
  private builtinExclude = (filePath: string) => false

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
    compiler.hooks.compilation.tap(PluginName, compilation => {
      this.tapHtmlWebpackPluginHooks(compilation.hooks as any)
    })
  }

  private tapHtmlWebpackPluginHooks(hooks: HtmlWebpackPluginHooks) {
    if (!hooks.htmlWebpackPluginBeforeHtmlProcessing) return

    hooks.htmlWebpackPluginBeforeHtmlProcessing.tapPromise(PluginName, async data => {
      const replacements = await this.getReplacements()

      replacements.forEach(r => {
        if (!r.include(data.assets.publicPath)) return
        if (r.exclude(data.assets.publicPath)) return
        data.html = data.html.replace(r.pattern, r.value as any)
      })

      return data
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

      const builtinReplacements = await this.getBuiltinReplacements()

      return userReplacements.concat(builtinReplacements)
    })()
  }

  private async getBuiltinReplacements() {
    const cwd = this.compiler.options.context || process.cwd()
    const [packageInfoReplacements, gitInfoReplacements] = await Promise.all([
      this.getPackageInfoReplacements(cwd),
      this.getGitInfoReplacements(cwd)
    ])
    return packageInfoReplacements.concat(gitInfoReplacements)
  }

  private async getGitInfoReplacements(cwd: string) {
    const [gitDescribe, gitRev] = await Promise.all([
      execa('git', 'describe --tags'.split(' '), { cwd }).catch(() => null),
      execa('git', 'rev-parse --short HEAD'.split(' '), { cwd }).catch(() => null),
    ])

    const gitDescribeContent = gitDescribe && gitDescribe.code === 0 && gitDescribe.stdout
    const gitRevContent = gitRev && gitRev.code === 0 && gitRev.stdout

    const gitDescribeReplacement = !gitDescribeContent ? null : {
      include: this.builtinInclude,
      exclude: this.builtinExclude,
      pattern: new RegExp('%GIT_DESCRIBE%', 'g'),
      value: gitDescribeContent,
    }

    const gitRevReplacement = !gitRevContent ? null : {
      include: this.builtinInclude,
      exclude: this.builtinExclude,
      pattern: new RegExp('%GIT_REV%', 'g'),
      value: gitRevContent,
    }

    const gitVersionReplacement = (!gitDescribeContent && !gitRevContent) ? null : {
      include: this.builtinInclude,
      exclude: this.builtinExclude,
      pattern: new RegExp('%GIT_VERSION%', 'g'),
      value: gitDescribeContent || gitRevContent,
    }

    return [gitDescribeReplacement!, gitRevReplacement!, gitVersionReplacement!].filter(i => i)
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
      include: this.builtinInclude,
      exclude: this.builtinExclude,
      pattern: new RegExp(`%${escapeStringRegexp(key)}%`, 'g'),
      value: packageInfo[key],
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
}
