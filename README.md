# interpolate-webpack-plugin [![Build Status](https://travis-ci.com/bolasblack/interpolate-webpack-plugin.svg?branch=master)](https://travis-ci.com/bolasblack/interpolate-webpack-plugin) [![Coverage Status](https://coveralls.io/repos/github/bolasblack/interpolate-webpack-plugin/badge.svg?branch=master)](https://coveralls.io/github/bolasblack/interpolate-webpack-plugin?branch=master)

Inspired by [react-dev-utils/InterpolateHtmlPlugin](https://github.com/facebook/create-react-app/blob/next/packages/react-dev-utils/InterpolateHtmlPlugin.js).

This Webpack plugin designed to lets us interpolate custom predefined variables into assets.

## Builtin variables

- `%GIT_DESCRIBE%`: result of `git describe --tags`
- `%GIT_REV%`: result of `git rev-parse --short HEAD`
- `%GIT_VERSION%`: `%GIT_DESCRIBE%` or `%GIT_REV%`
- `%packageJson.[data.path.in.package.json]%`: any data in `package.json`

## Install

```bash
yarn add @c4605/interpolate-webpack-plugin -D
# or
npm install @c4605/interpolate-webpack-plugin --save-dev
```

## Usage

```js
import { InterpolateWebpackPlugin, DefaultReplacer } from 'interpolate-webpack-plugin'

export default {
  // ... webpack configs
  plugins: [
    // Use with default replacer
    new InterpolateWebpackPlugin(
      new DefaultReplacer({ options }),
    ),

    // Or use custom replacer
    new InterpolateWebpackPlugin({ replacer: (filename, source) =>
      new PrefixSource(
        prefix: '/* prefix */',
        source,
      )
    }),
  ],
}
```

Options structure can find in `src/index.ts#InterpolateWebpackPluginOptions`.

The default replacer will not modify binary files (checked by [isBinaryFile](https://github.com/gjtorikian/isBinaryFile)) and sourcemap files.

If you want to use the builtin variables, you can to this:

```js
module.exports = async () => {
  // ... webpack configs
  plugins: [
    new webpack.DefinePlugin({
      ...(await new DefaultReplacer({ options }).getDefinePluginOptions()),
      // ... other defines
    }),
  ],
}
```

## Development

```bash
yarn build # build code
yarn watch # build and watch code
yarn test # run tests
```
