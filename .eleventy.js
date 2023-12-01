const syntaxHighlight = require('@11ty/eleventy-plugin-syntaxhighlight')
const esbuild = require('esbuild')
const { sassPlugin } = require('esbuild-sass-plugin')
const htmlMinifier = require('html-minifier')
const { PurgeCSS } = require('purgecss')
const fs = require('fs').promises


/**
 * @param {import('@11ty/eleventy').UserConfig} eleventyConfig 
 */
module.exports = function (eleventyConfig) {
  const isDevelopment = false // process.env.ELEVENTY_RUN_MODE !== 'build'

  if (!isDevelopment) {
    console.log('Doing a release version...')
  }

  eleventyConfig.addPassthroughCopy({ 'misc/CNAME': 'CNAME' })
  eleventyConfig.addPassthroughCopy({ 'misc/.nojekyll': '.nojekyll' })
  eleventyConfig.addPassthroughCopy({ 'misc/robots.txt': 'robots.txt' })

  eleventyConfig.addPlugin(syntaxHighlight)

  eleventyConfig.addWatchTarget('./css/')

  eleventyConfig.addTransform('htmlmin', function (content, outputPath) {
    if (outputPath.endsWith('.html')) {
      return htmlMinifier.minify(content, {
        collapseBooleanAttributes: true,
        collapseWhitespace: true,
        removeComments: true,
        useShortDoctype: true
      })
    }

    return content
  })

  eleventyConfig.on('afterBuild', async () => {
    await esbuild.build({
      entryPoints: ['css/main.scss', 'css/blog.scss', 'css/front.scss'],
      outdir: '_site/assets',
      minify: !isDevelopment,
      sourcemap: isDevelopment,
      plugins: [sassPlugin()]
    })

    if (!isDevelopment) {
      console.log('Purging CSS...')

      const purgeResult = await new PurgeCSS().purge()
      await Promise.all(purgeResult.map(res => {
        console.log('Overwriting purged file', res.file)
        fs.writeFile(res.file, res.css)
      }))
    }
  })
}
