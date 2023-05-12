import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import * as webpack from 'webpack'
import * as HtmlWebpackPlugin from 'html-webpack-plugin'
import { InterpolateWebpackPlugin, DefaultReplacer } from './index'

describe('InterpolateWebpackPlugin', () => {
  it('works', async () => {
    const { outdir } = await runWebpack(
      new DefaultReplacer({
        replacements: [
          {
            pattern: /%hello%/g,
            value: 'wwwwworld',
            exclude: (filePath) => filePath.endsWith('.map'),
          },
        ],
      }),
    )

    console.log('outdir', outdir)
    expect(
      fs.readFileSync(path.join(outdir, 'index.html'), 'utf8'),
    ).not.toContain('%hello%')
    expect(fs.readFileSync(path.join(outdir, 'main.js'), 'utf8')).not.toContain(
      '%hello%',
    )
    expect(fs.readFileSync(path.join(outdir, 'main.js.map'), 'utf8')).toContain(
      '%hello%',
    )
  })
})

function runWebpack(
  options: InterpolateWebpackPlugin.ConstructOptions,
): Promise<{
  stats: webpack.Stats
  outdir: string
}> {
  return new Promise((resolve, reject) => {
    const outdir = fs.mkdtempSync(
      path.join(os.tmpdir(), `InterpolateWebpackPluginTest${Date.now()}`),
    )

    webpack(
      {
        mode: 'production',
        devtool: 'source-map',
        entry: path.resolve(__dirname, './__fixtures/index.js'),
        output: {
          path: outdir,
        },
        module: {
          rules: [
            {
              test: /\.css$/i,
              loader: 'css-loader',
              options: {
                url: true,
              },
            },
          ],
        },
        plugins: [
          new HtmlWebpackPlugin({
            title: '%hello%',
          }),
          new InterpolateWebpackPlugin(options),
        ],
      },
      (err, stats) => {
        if (err) {
          reject(err)
          return
        }

        if (stats?.hasErrors()) {
          reject(new Error(stats.toString()))
          return
        }

        resolve({
          outdir,
          stats: stats!,
        })
      },
    )
  })
}
