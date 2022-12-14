'use strict'

const fs = require('node:fs')
const { promises: fsp } = fs
const ospath = require('node:path')

module.exports.register = function ({ config = {} }) {
  const refname = config.refname || process.env.BUILD_REFNAME
  if (!refname) return
  this.once('playbookBuilt', async ({ playbook }) => {
    const { concat: get } = this.require('simple-get')
    const asciidocAttrs = ((playbook.asciidoc ||= {}).attributes ||= {})
    const siteManifestUrl = asciidocAttrs['primary-site-manifest-url'] || `${playbook.site.url}/site-manifest.json`
    const siteManifestData = await (siteManifestUrl.startsWith('https://') || siteManifestUrl.startsWith('http://')
      ? download(get, siteManifestUrl)
      : fsp.readFile(siteManifestUrl)
    ).then(JSON.parse)
    const isBranch = refname === 'main' || refname.endsWith('.x')
    let version = config.version || process.env.BUILD_VERSION
    if (!version) {
      const repoUrl = await this.require('isomorphic-git')
        .listRemotes({ fs, dir: playbook.dir })
        .then((remotes) => remotes.find(({ remote }) => remote === 'origin').url)
      const { rawgitUrl = 'https://raw.githubusercontent.com' } = config
      const propertiesUrl = `${rawgitUrl}${new URL(repoUrl).pathname}/${refname}/gradle.properties`
      version = await download(get, propertiesUrl).then((contents) => extractVersion(contents, refname))
    }
    if (isBranch && version.endsWith('-SNAPSHOT')) version = version.slice(0, -9)
    const versionsInManifest = Object.values(siteManifestData.components)[0].versions
    if (!(version in versionsInManifest && isBranch === !!versionsInManifest[version].prerelease)) {
      const category = require('path').basename(module.id, '.js')
      await fsp.writeFile(ospath.join(playbook.dir, '.full-build'), '')
      console.log(`${category}: version ${version} not previously built; reverting to full build`)
      return
    }
    Object.assign(
      playbook.content.sources[0],
      isBranch ? { branches: [refname], tags: [] } : { branches: [], tags: [refname] }
    )
    Object.assign(asciidocAttrs, { 'primary-site-url': '.', 'primary-site-manifest-url': siteManifestUrl })
    this.updateVariables({ playbook })
  })
}

function download (get, url) {
  return new Promise((resolve, reject) =>
    get({ url }, (err, response, contents) => {
      if (err) return reject(err)
      if (response.statusCode === 200) return resolve(contents)
      const message = `Response code ${response.statusCode} (${response.statusMessage})`
      reject(Object.assign(new Error(message), { name: 'HTTPError' }))
    })
  )
}

function extractVersion (contents, fallback) {
  for (const line of (contents.toString().trimEnd() + `\nversion=${fallback}`).split('\n')) {
    if (line.startsWith('version=')) return line.slice(8)
  }
}
