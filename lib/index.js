"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const webpack_sources_1 = require("webpack-sources");
const util_1 = require("util");
const isbinaryfile_1 = __importDefault(require("isbinaryfile"));
const fs_1 = __importDefault(require("fs"));
const find_up_1 = __importDefault(require("find-up"));
const execa_1 = __importDefault(require("execa"));
const flat_1 = __importDefault(require("flat"));
const escape_string_regexp_1 = __importDefault(require("escape-string-regexp"));
exports.PluginName = 'InterpolateWebpackPlugin';
class InterpolateWebpackPlugin {
    constructor(options) {
        this.builtinInclude = (filePath) => true;
        this.builtinExclude = (filePath) => filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.map');
        this.options = options || {};
        if (options && options.builtin) {
            if (options.builtin.include != null) {
                this.builtinInclude = this.transformAndCombineMatchers(options.builtin.include);
            }
            if (options.builtin.exclude != null) {
                this.builtinInclude = this.transformAndCombineMatchers(options.builtin.exclude);
            }
        }
    }
    apply(compiler) {
        this.compiler = compiler;
        compiler.hooks.emit.tapPromise(exports.PluginName, (compilation) => __awaiter(this, void 0, void 0, function* () {
            const replacements = yield this.getReplacements();
            Object.keys(compilation.assets).forEach(filename => {
                const relatedReplacements = replacements.filter(r => r.include(filename) && !r.exclude(filename));
                if (!relatedReplacements.length)
                    return;
                const source = compilation.assets[filename].source();
                if (typeof source !== 'string' && isbinaryfile_1.default.sync(source, source.length))
                    return;
                const newSource = relatedReplacements.reduce((r, replacement) => {
                    return r.replace(replacement.pattern, replacement.value);
                }, source.toString());
                compilation.assets[filename] = new webpack_sources_1.RawSource(newSource);
            });
        }));
    }
    getReplacements() {
        if (this.getReplacementsPromise)
            return this.getReplacementsPromise;
        return this.getReplacementsPromise = (() => __awaiter(this, void 0, void 0, function* () {
            const userReplacements = this.toArray(this.options.replacements || []).map(r => (Object.assign({}, r, { include: this.transformAndCombineMatchers(r.include == null ? true : r.include), exclude: this.transformAndCombineMatchers(r.exclude == null ? false : r.exclude) })));
            const builtinReplacements = (yield this.getBuiltinReplacements())
                .filter(r => r.value)
                .map(replacement => ({
                include: this.builtinInclude,
                exclude: this.builtinExclude,
                pattern: new RegExp(`%${escape_string_regexp_1.default(replacement.pattern)}%`, 'g'),
                value: replacement.value,
            }));
            return userReplacements.concat(builtinReplacements);
        }))();
    }
    getBuiltinReplacements() {
        return __awaiter(this, void 0, void 0, function* () {
            const cwd = this.getContext();
            const [packageInfoReplacements, gitInfoReplacements] = yield Promise.all([
                this.getPackageInfoReplacements(cwd),
                this.getGitInfoReplacements(cwd)
            ]);
            return packageInfoReplacements.concat(gitInfoReplacements);
        });
    }
    definePlugin() {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.getBuiltinReplacements()).reduce((r, replacement) => {
                r[replacement.pattern] = `"${replacement.value}"`;
                return r;
            }, {});
        });
    }
    getGitInfoReplacements(cwd) {
        return __awaiter(this, void 0, void 0, function* () {
            const [gitDescribe, gitRev] = yield Promise.all([
                execa_1.default('git', 'describe --tags'.split(' '), { cwd }).catch(() => null),
                execa_1.default('git', 'rev-parse --short HEAD'.split(' '), { cwd }).catch(() => null),
            ]);
            const gitDescribeContent = gitDescribe && gitDescribe.code === 0 && String(gitDescribe.stdout).trim() || '';
            const gitRevContent = gitRev && gitRev.code === 0 && String(gitRev.stdout).trim() || '';
            const gitDescribeReplacement = {
                pattern: 'GIT_DESCRIBE',
                value: gitDescribeContent,
            };
            const gitRevReplacement = {
                pattern: 'GIT_REV',
                value: gitRevContent,
            };
            const gitVersionReplacement = {
                pattern: 'GIT_VERSION',
                value: gitDescribeContent || gitRevContent,
            };
            return [gitDescribeReplacement, gitRevReplacement, gitVersionReplacement];
        });
    }
    getPackageInfoReplacements(cwd) {
        return __awaiter(this, void 0, void 0, function* () {
            let pkgFilePath = null;
            try {
                pkgFilePath = yield find_up_1.default('package.json', { cwd });
            }
            catch (_a) { }
            if (!pkgFilePath)
                return [];
            let packageJson;
            try {
                const packageJsonContent = yield util_1.promisify(fs_1.default.readFile)(pkgFilePath);
                packageJson = JSON.parse(packageJsonContent.toString());
            }
            catch (_b) {
                return [];
            }
            const packageInfo = flat_1.default({ packageJson });
            return Object.keys(packageInfo).map(key => ({
                pattern: key,
                value: String(packageInfo[key]),
            }));
        });
    }
    toArray(obj) {
        return Array.isArray(obj) ? obj : [obj];
    }
    transformAndCombineMatchers(matcherOptions) {
        if (Array.isArray(matcherOptions)) {
            const matchers = matcherOptions.map(this.toMatcher);
            return (filePath) => matchers.every(matcher => matcher(filePath));
        }
        else {
            return this.toMatcher(matcherOptions);
        }
    }
    toMatcher(val) {
        if (val instanceof RegExp)
            return str => val.test(str);
        if (typeof val === 'string')
            return str => str.includes(val);
        if (typeof val === 'function')
            return val;
        return _ => val;
    }
    getContext() {
        return (this.options && this.options.context) ||
            (this.compiler && this.compiler.options.context) ||
            process.cwd();
    }
}
exports.InterpolateWebpackPlugin = InterpolateWebpackPlugin;
//# sourceMappingURL=index.js.map