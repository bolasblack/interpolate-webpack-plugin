# interpolate-webpack-plugin

Inspired by [react-dev-utils/InterpolateHtmlPlugin](https://github.com/facebook/create-react-app/blob/next/packages/react-dev-utils/InterpolateHtmlPlugin.js)

This Webpack plugin designed to lets us interpolate custom predefined variables into html managed by [`HtmlWebpackPlugin`](https://github.com/jantimon/html-webpack-plugin).

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
    new InterpolateWebpackPlugin({ options }), // should under HtmlWebpackPlugin
  ],
}
```

Options structure can find in `src/index.ts#InterpolateWebpackPluginOptions`
