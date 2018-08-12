import { Plugin, Compiler } from 'webpack';
declare type SndArgType<F extends (arg1: any, arg2: any, ...args: any[]) => any> = F extends (arg1: any, arg2: infer R, ...args: any[]) => any ? R : never;
export declare const PluginName = "InterpolateWebpackPlugin";
export declare type MatcherOption = boolean | string | RegExp | ((filePath: string) => boolean);
export interface InterpolateWebpackPluginOptionsReplacement {
    include?: MatcherOption[];
    exclude?: MatcherOption[];
    pattern: string | RegExp;
    value: string | SndArgType<String['replace']>;
}
export interface InterpolateWebpackPluginOptions {
    builtin?: {
        include?: MatcherOption[];
        exclude?: MatcherOption[];
    };
    replacements?: InterpolateWebpackPluginOptionsReplacement[];
}
export interface InterpolateWebpackPluginReplacement {
    include: (filePath: string) => boolean;
    exclude: (filePath: string) => boolean;
    pattern: InterpolateWebpackPluginOptionsReplacement['pattern'];
    value: InterpolateWebpackPluginOptionsReplacement['value'];
}
export declare class InterpolateWebpackPlugin implements Plugin {
    private options;
    private compiler;
    private builtinInclude;
    private builtinExclude;
    constructor(options?: InterpolateWebpackPluginOptions);
    apply(compiler: Compiler): void;
    private tapHtmlWebpackPluginHooks;
    private getReplacementsPromise?;
    private getReplacements;
    private getBuiltinReplacements;
    private getGitInfoReplacements;
    private getPackageInfoReplacements;
    private toArray;
    private transformAndCombineMatchers;
    private toMatcher;
}
export {};
//# sourceMappingURL=index.d.ts.map