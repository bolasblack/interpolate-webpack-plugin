import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import * as PoiCore from 'poi'
import * as webpack from 'webpack'
import { InterpolateWebpackPlugin, DefaultReplacer } from './index'

describe('InterpolateWebpackPlugin', () => {
  it('works', async () => {
    const stats = await runWebpack(
      new DefaultReplacer({
        replacements: [
          {
            pattern: /%hello%/g,
            value: 'wwwwworld',
          },
          {
            pattern: /variable/g,
            value: 'replaced',
            exclude: filePath => filePath.endsWith('.map'),
          },
        ],
      }),
    )

    Object.keys(stats.compilation.assets).forEach(filename => {
      expect(stats.compilation.assets[filename].source()).not.toContain(
        '%hello%',
      )
      expect(
        stats.compilation.assets['assets/js/index.js'].source(),
      ).not.toContain('variable')
      expect(
        stats.compilation.assets['assets/js/index.js.map'].source(),
      ).toContain('variable')
    })
  })
})

function runWebpack(options: InterpolateWebpackPlugin.ConstructOptions) {
  return new Promise<webpack.Stats>((resolve, reject) => {
    const outdir = fs.mkdtempSync(
      path.join(os.tmpdir(), `InterpolateWebpackPluginTest${Date.now()}`),
    )

    const poi = new PoiCore()
    poi.config = {
      ...poi.config,
      entry: path.resolve(__dirname, './__fixtures/index.js'),
      output: {
        ...poi.config.output,
        dir: outdir,
        html: {
          title: '%hello%',
        },
      },
      css: {
        ...poi.config.css,
        extract: true,
      },
      chainWebpack(config) {
        config.mode('none')
        config
          .plugin('InterpolateWebpackPlugin')
          .use(InterpolateWebpackPlugin, [options])
        config.plugins.delete('print-status')
      },
    }

    webpack(poi.createWebpackChain().toConfig(), (err, stats) => {
      if (err) {
        reject(err)
        return
      }

      if (stats.hasErrors()) {
        reject(new Error(stats.toString()))
        return
      }

      resolve(stats)
    })
  })
}
