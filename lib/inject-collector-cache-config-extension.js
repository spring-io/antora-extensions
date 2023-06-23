'use strict'

const expandPath = require('@antora/expand-path-helper')
const ospath = require('path')
const resolvedCacheScanDirIndexJs = require.resolve('@springio/antora-extensions/cache-scandir')
const { createHash } = require('crypto')

module.exports.register = function ({ playbook, config = {} }) {
  const logger = this.getLogger('inject-collector-cache-config-extension')
  const siteUrl = playbook.site?.url
  const outputDir = ospath.join(playbook.dir, 'build/antora/inject-collector-cache-config-extension/.cache')
  const configuredBaseCacheUrl = config.baseCacheUrl
  if (!siteUrl && !configuredBaseCacheUrl) {
    throw new Error(
      "One of playbook site.url or inject-collector-cache-config-extension plugin's base_cache_url property is required."
    )
  }
  const baseCacheUrl = configuredBaseCacheUrl || siteUrl + '/.cache'
  const getUserCacheDir = this.require('cache-directory')
  const expandPath = this.require('@antora/expand-path-helper')
  const fs = this.require('fs')
  const decompress = this.require('decompress')
  const { concat: get } = this.require('simple-get')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  this.once('contentAggregated', async ({ playbook, contentAggregate }) => {
    for (const { origins } of contentAggregate) {
      for (const origin of origins) {
        const { url, gitdir, refhash, worktree, startPath = '.', descriptor, tag, refname } = origin
        const baseCacheDir = getBaseCacheDir(getUserCacheDir, playbook)
        const repositoryCachDirName = generateWorktreeFolderName({ url, gitdir, worktree })
        const baseCollectorCacheCacheDir = ospath.join(baseCacheDir, 'collector-cache', repositoryCachDirName)
        const collectorCacheDir = ospath.join(baseCacheDir, 'collector')
        const worktreeDir = worktree || ospath.join(collectorCacheDir, repositoryCachDirName)
        const expandPathContext = { base: worktreeDir, cwd: worktreeDir, dot: ospath.join(worktreeDir, startPath) }
        const collectorConfig = descriptor?.ext?.collector
        if (collectorConfig !== undefined && tag !== undefined) {
          const shortref = refhash.slice(0, 7)
          const cacheDirName = `${shortref}-${refname}`
          const cacheDir = ospath.join(baseCollectorCacheCacheDir, cacheDirName)
          const zipFileName = `${cacheDirName}.zip`
          const zipCacheFile = ospath.join(outputDir, zipFileName)
          if (!fs.existsSync(baseCollectorCacheCacheDir)) {
            fs.mkdirSync(baseCollectorCacheCacheDir, { recursive: true })
          }
          if (!fs.existsSync(cacheDir)) {
            // try and restore from URL by downloading zip
            const cacheUrl = `${baseCacheUrl}/${cacheDirName}.zip`
            const content = await download(get, cacheUrl).then((content) => content)
            if (content) {
              fs.writeFileSync(zipCacheFile, content)
              await decompress(zipCacheFile, ospath.join(baseCollectorCacheCacheDir, cacheDirName)).then((files) =>
                logger.debug(`Successfully unzipped ${zipCacheFile}.`)
              )
              logger.info(`Successfully restored cache from ${cacheUrl}`)
            } else {
              logger.info(`Unable to restore cache from ${cacheUrl}`)
            }
          }
          if (fs.existsSync(cacheDir)) {
            // use the cache
            origin.descriptor.ext.collector = {
              scan: {
                dir: cacheDir,
              },
            }
            logger.info(`Use the cache found at ${cacheDir}`)
          } else {
            const normalizedCollectorConfig = Array.isArray(collectorConfig) ? collectorConfig : [collectorConfig]
            origin.descriptor.ext.collector = normalizedCollectorConfig
            normalizedCollectorConfig.forEach((collector) => {
              const { scan: scanConfig = [] } = collector
              // cache the output of the build
              const scanDir = expandPath(scanConfig.dir, expandPathContext)
              logger.info(
                `Configuring collector to cache '${scanDir}' at '${cacheDir}' and zip the results at '${zipCacheFile}'`
              )
              const cachedCollectorConfig = createCachedCollectorConfig(scanDir, cacheDir, zipCacheFile)
              normalizedCollectorConfig.push.apply(normalizedCollectorConfig, cachedCollectorConfig)
              // add the zip of cache to be published
            })
          }
        }
      }
    }
  })
}

function download (get, url) {
  return new Promise((resolve, reject) =>
    get({ url }, (err, response, contents) => {
      if (response?.statusCode === 404) return resolve(undefined)
      if (err) return reject(err)
      if (response?.statusCode === 200) return resolve(contents)
      const message = `${url} returned response code ${response?.statusCode} (${response?.statusMessage})`
      reject(Object.assign(new Error(message), { name: 'HTTPError' }))
    })
  )
}

function getBaseCacheDir (getUserCacheDir, { dir: dot, runtime: { cacheDir: preferredDir } = {} }) {
  return preferredDir == null
    ? getUserCacheDir(`antora${process.env.NODE_ENV === 'test' ? '-test' : ''}`) || ospath.join(dot, '.cache/antora')
    : expandPath(preferredDir, { dot })
}

function generateWorktreeFolderName ({ url, gitdir, worktree }) {
  if (worktree === undefined) return ospath.basename(gitdir, '.git')
  return `${url.substr(url.lastIndexOf('/') + 1)}-${createHash('sha1').update(url).digest('hex')}`
}

function createCachedCollectorConfig (scanDir, cacheDir, zipFileName, siteDir) {
  return [
    {
      run: {
        command: `node '${resolvedCacheScanDirIndexJs}' '${scanDir}' '${cacheDir}' '${zipFileName}'`,
      },
    },
  ]
}
