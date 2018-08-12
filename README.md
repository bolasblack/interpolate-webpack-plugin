# interpolate-webpack-plugin

Inspired by [react-dev-utils/InterpolateHtmlPlugin](https://github.com/facebook/create-react-app/blob/next/packages/react-dev-utils/InterpolateHtmlPlugin.js).

This Webpack plugin designed to lets us interpolate custom predefined variables into assets.

## Builtin variables

* `%GIT_DESCRIBE%`: result of `git describe --tags`
* `%GIT_REV%`: result of `git rev-parse --short HEAD`
* `%GIT_VERSION%`: `%GIT_DESCRIBE%` or `%GIT_REV%`
* `%packageJson.[data.path.in.package.json]%`: any data in `package.json`

## Usage

```
module.exports = {
  // ... webpack configs
  plugins: [
    // ... other plugins
    new InterpolateWebpackPlugin({ options }),
    // ... other plugins
  ],
}
```

Options structure can find in `src/index.ts#InterpolateWebpackPluginOptions`.

This plugin will not modify binary files (checked by [isBinaryFile](https://github.com/gjtorikian/isBinaryFile)) and javascript/css/sourcemap files (may break the source map).

If you want to use the builtin variables, you can to this:

```
const interpolateWebpackPlugin = new InterpolateWebpackPlugin({ options }),

module.exports = async () => {
  // ... webpack configs
  plugins: [
    // ... other plugins
    interpolateWebpackPlugin,
    new webpack.DefinePlugin({
      ...(await interpolateWebpackPlugin.definePlugin()),
      // ... other defines
    }),
    // ... other plugins
  ],
}
```
