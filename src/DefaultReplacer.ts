import { Source, ReplaceSource } from 'webpack-sources'
import { Compiler } from 'webpack'
import { promisify } from 'util'
import isBinaryFile from 'isbinaryfile'
import * as fs from 'fs'
import * as findUp from 'find-up'
import * as execa from 'execa'
import * as flat from 'flat'
import * as escapeStringRegexp from 'escape-string-regexp'
import { InterpolateWebpackPlugin } from './index'

interface DefaultReplacerReplacement {
  exclude: (filePath: string) => boolean
  pattern: RegExp
  value: DefaultReplacer.ConstructOptionsReplacement['value']
}

export class DefaultReplacer {
  private builtinExclude: DefaultReplacer.MatchFn = (filePath: string) =>
    filePath.endsWith('.map')

  constructor(private options: DefaultReplacer.ConstructOptions = {}) {
    if (options && options.builtin) {
      if (options.builtin.exclude != null) {
        this.builtinExclude = this.transformAndCombineMatchers(
          options.builtin.exclude,
        )
      }
    }
  }

  async replacer(
    source: Source,
    ctx: InterpolateWebpackPlugin.ReplacerContext,
  ) {
    const replacements = await this.getReplacements(ctx.compiler)

    const relatedReplacements = replacements.filter(
      r => !r.exclude(ctx.filename),
    )

    if (!relatedReplacements.length) return source

    const sourceContent = source.source() as string | Buffer

    if (
      typeof sourceContent !== 'string' &&
      isBinaryFile.sync(sourceContent, sourceContent.length)
    ) {
      return source
    }

    const newSource = new ReplaceSource(source)

    const assetRawSource = sourceContent.toString()
    relatedReplacements.forEach(replacement => {
      if (replacement)
        assetRawSource.replace(replacement.pattern, (...args) => {
          // args: [match, p1, p2, ..., offset, wholeString]
          const match = args[0]
          const offset: number = args[args.length - 2]
          newSource.replace(
            offset,
            offset + match.length - 1,
            replacement.value,
          )
          return match
        })
    })

    return newSource
  }

  async getDefinePluginOptions() {
    const replacements = await this.getBuiltinReplacements()
    return replacements.reduce(
      (res, { pattern, value }) => {
        res[pattern] = value
        return res
      },
      {} as Record<string, any>,
    )
  }

  async getBuiltinReplacements(compiler?: Compiler) {
    const cwd = this.getContext(compiler)
    const [packageInfoReplacements, gitInfoReplacements] = await Promise.all([
      this.getPackageInfoReplacements(cwd),
      this.getGitInfoReplacements(cwd),
    ])
    return packageInfoReplacements.concat(gitInfoReplacements || [])
  }

  private getReplacementsPromise?: Promise<DefaultReplacerReplacement[]>
  private getReplacements(
    compiler: Compiler,
  ): Promise<DefaultReplacerReplacement[]> {
    if (this.getReplacementsPromise) return this.getReplacementsPromise

    return (this.getReplacementsPromise = (async () => {
      const userReplacements = this.toArray(
        this.options.replacements || [],
      ).map(r => ({
        ...r,
        pattern:
          r.pattern instanceof RegExp
            ? r.pattern
            : new RegExp(escapeStringRegexp(r.pattern), 'g'),
        exclude: this.transformAndCombineMatchers(
          r.exclude == null ? false : r.exclude,
        ),
      }))

      const builtinReplacements = (await this.getBuiltinReplacements(compiler))
        .filter(r => r.value)
        .map(replacement => ({
          exclude: this.builtinExclude,
          pattern: new RegExp(
            `%${escapeStringRegexp(replacement.pattern)}%`,
            'g',
          ),
          value: replacement.value,
        }))

      return userReplacements.concat(builtinReplacements)
    })())
  }

  private async getGitInfoReplacements(cwd: string) {
    const [gitDescribe, gitRev] = await Promise.all([
      execa('git', 'describe --tags'.split(' '), { cwd }).catch(() => null),
      execa('git', 'rev-parse --short HEAD'.split(' '), { cwd }).catch(
        () => null,
      ),
    ])

    if (!gitDescribe || !gitRev) return

    const gitDescribeContent =
      (gitDescribe &&
        gitDescribe.exitCode === 0 &&
        String(gitDescribe.stdout).trim()) ||
      ''
    const gitRevContent =
      (gitRev && gitRev.exitCode === 0 && String(gitRev.stdout).trim()) || ''

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
    let pkgFilePath: string | undefined
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

    const packageInfo: Record<string, any> = flat({ packageJson })
    return Object.keys(packageInfo).map(key => ({
      pattern: key,
      value: String(packageInfo[key]),
    }))
  }

  private toArray<T>(obj: T | T[]) {
    return Array.isArray(obj) ? obj : [obj]
  }

  private transformAndCombineMatchers(
    matcherOptions:
      | DefaultReplacer.MatcherOption
      | DefaultReplacer.MatcherOption[],
  ) {
    if (Array.isArray(matcherOptions)) {
      const matchers = matcherOptions.map(this.toMatcher)
      return (filePath: string) => matchers.every(matcher => matcher(filePath))
    } else {
      return this.toMatcher(matcherOptions)
    }
  }

  private toMatcher(
    val: DefaultReplacer.MatcherOption,
  ): (filePath: string) => boolean {
    if (val instanceof RegExp) return str => val.test(str)
    if (typeof val === 'string') return str => str.includes(val)
    if (typeof val === 'function') return val
    return _ => val
  }

  private getContext(compiler?: Compiler) {
    return (
      (this.options && this.options.context) ||
      (compiler && compiler.options.context) ||
      process.cwd()
    )
  }
}

export namespace DefaultReplacer {
  export type MatchFn = (filePath: string) => boolean

  export type MatcherOption = boolean | string | RegExp | MatchFn

  export interface ConstructOptionsReplacement {
    exclude?: MatcherOption | MatcherOption[]
    pattern: string | RegExp
    value: string
  }

  export interface ConstructOptions {
    context?: string
    builtin?: {
      exclude?: MatcherOption | MatcherOption[]
    }
    replacements?: ConstructOptionsReplacement[]
  }
}
