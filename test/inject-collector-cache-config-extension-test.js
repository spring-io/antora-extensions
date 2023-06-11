/* eslint-env mocha */
'use strict'

const { expect, cleanDir, startWebServer, trapAsyncError } = require('./harness')
const { name: packageName } = require('#package')
const fs = require('fs')
const os = require('os')
const ospath = require('node:path')
const resolvedCacheScanDirIndexJs = require.resolve('@springio/antora-extensions/cache-scandir')

const FIXTURES_DIR = ospath.join(__dirname, 'fixtures')

describe('inject-collector-cache-config-extension', () => {
  const ext = require(packageName + '/inject-collector-cache-config-extension')

  const createTag = (ref, componentName = 'componentName') => {
    return {
      name: componentName,
      origins: [
        {
          url: 'https://github.com/spring-projects/spring-security',
          descriptor: { ext: { collector: { scan: { dir: './build/antora-resources' } } } },
          gitdir: gitDir,
          refhash: '6ca8fb4889f1fcd5c6c3052dfd82a5507f2bf4c2',
          reftype: 'tag',
          refname: ref,
          tag: ref,
        },
      ],
    }
  }

  const createBranch = (ref) => {
    return {
      origins: [
        {
          descriptor: {},
          gitdir: gitDir,
          reftype: 'branch',
          refname: ref,
          branch: ref,
        },
      ],
    }
  }

  const createGeneratorContext = () => ({
    messages: [],
    variables: {},
    once (eventName, fn) {
      this[eventName] = fn
    },
    on (eventName, fn) {
      this[eventName] = fn
    },
    require,
    getLogger (name) {
      const messages = this.messages
      const appendMessage = function (message) {
        messages.push(message)
      }
      return {
        info: appendMessage,
        debug: appendMessage,
      }
    },
    updateVariables (updates) {
      Object.assign(this.variables, updates)
    },
  })

  const runContentAggregate = async (config = {}) => {
    ext.register.call(generatorContext, { config })
    return generatorContext.contentAggregated({ contentAggregate })
  }

  const tempDir = function (prefix) {
    return fs.mkdtempSync(ospath.join(os.tmpdir(), prefix))
  }

  let contentAggregate
  let generatorContext
  let httpServer
  let httpServerUrl
  let workDir
  let playbook
  let playbookDir
  let gitDir
  let cacheDir

  beforeEach(async () => {
    ;[httpServer, httpServerUrl] = await startWebServer('localhost', FIXTURES_DIR)
    workDir = tempDir('inject-collector-cache-extension-test-')
    playbookDir = ospath.join(workDir, 'playbook')
    fs.mkdirSync(playbookDir)
    gitDir = ospath.join(workDir, 'git/spring-security')
    fs.mkdirSync(gitDir, { recursive: true })
    cacheDir = ospath.join(workDir, '.cache')
    // extension optionally creates this directory
    generatorContext = createGeneratorContext()
    contentAggregate = [createTag('1.0.0')]
    playbook = {
      dir: playbookDir,
      site: { url: httpServerUrl },
      asciidoc: { attributes: {} },
      content: {
        sources: [
          {
            url: 'https://github.com/spring-projects/spring-security',
            branches: ['main', '6.*'],
            tags: ['6.*'],
            startPath: 'docs',
          },
        ],
      },
      runtime: { cacheDir },
    }
  })

  afterEach(async () => {
    if (httpServer.listening) await httpServer.shutdown()
    cleanDir(workDir)
  })

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension', () => {
      ext.register.call(generatorContext, { config: {}, playbook })
      expect(generatorContext.contentAggregated).to.be.instanceOf(Function)
    })
  })

  describe('contentAggregate', () => {
    it('no tags', async () => {
      contentAggregate = [createBranch('main')]
      ext.register.call(generatorContext, { playbook })
      await generatorContext.contentAggregated({ playbook, contentAggregate })
      expect(generatorContext.messages).to.eql([])
    })
    it('no collector config', async () => {
      const tag = createTag('1.0.0')
      delete tag.origins[0].descriptor
      contentAggregate = [tag]
      ext.register.call(generatorContext, { playbook })
      await generatorContext.contentAggregated({ playbook, contentAggregate })
      expect(contentAggregate[0].origins[0].descriptor).to.eql(undefined)
      expect(generatorContext.messages).to.eql([])
    })
    it('no site or site.url', async () => {
      delete playbook.site
      expect(() => ext.register.call(generatorContext, { playbook })).to.throws(
        "One of playbook site.url or inject-collector-cache-config-extension plugin's base_cache_url property is required."
      )
      expect(generatorContext.messages).to.eql([])
    })
    it('cache http fails', async () => {
      ext.register.call(generatorContext, { playbook })
      httpServer.handler((request, response) => {
        response.writeHead(500, { 'Content-Type': 'text/html' })
        response.end('<!DOCTYPE html><html><body>Error</body></html>', 'utf8')
      })
      expect(await trapAsyncError(generatorContext.contentAggregated, { playbook, contentAggregate })).to.throws(
        `${httpServerUrl}/.cache/6ca8fb4-1.0.0.zip returned response code 500 (Internal Server Error)`
      )
    })
    it('cache not found', async () => {
      const tag = createTag('1.0.0')
      tag.origins[0].refhash = tag.origins[0].refhash.split('').reverse().join('')
      contentAggregate = [tag]
      ext.register.call(generatorContext, { playbook })
      await generatorContext.contentAggregated({ playbook, contentAggregate })
      expect(fs.existsSync(ospath.join(cacheDir, 'collector-cache/spring-security'))).to.equal(true)
      const actual = contentAggregate[0].origins[0].descriptor.ext
      const scan = ospath.join(cacheDir, 'collector/spring-security/build/antora-resources')
      const cache = ospath.join(cacheDir, 'collector-cache/spring-security/2c4fb2f-1.0.0')
      const zipFileName = ospath.join(
        playbookDir,
        'build/antora/inject-collector-cache-config-extension/.cache/2c4fb2f-1.0.0.zip'
      )
      const expected = {
        collector: [
          {
            scan: {
              dir: './build/antora-resources',
            },
          },
          {
            run: {
              command: `node '${resolvedCacheScanDirIndexJs}' '${scan}' '${cache}' '${zipFileName}'`,
            },
          },
        ],
      }
      expect(actual).to.eql(expected)
      expect(generatorContext.messages).to.eql([
        `Unable to restore cache from ${httpServerUrl}/.cache/2c4fb2f-1.0.0.zip`,
      ])
    })
    it('cache downloaded', async () => {
      const zipFileName = ospath.join(
        playbookDir,
        'build/antora/inject-collector-cache-config-extension/.cache/6ca8fb4-1.0.0.zip'
      )
      contentAggregate = [createTag('1.0.0')]
      ext.register.call(generatorContext, { playbook })
      await generatorContext.contentAggregated({ playbook, contentAggregate })
      const actual = contentAggregate[0].origins[0].descriptor.ext
      const scanDir = ospath.join(cacheDir, 'collector-cache/spring-security/6ca8fb4-1.0.0')
      const expected = {
        collector: {
          scan: {
            dir: scanDir,
          },
        },
      }
      expect(actual).to.eql(expected)
      expect(fs.existsSync(scanDir))
      expect(fs.existsSync(ospath.join(scanDir, 'antora.yml')))
      expect(fs.existsSync(ospath.join(scanDir, 'modules/ROOT/pages/generated.adoc')))
      expect(generatorContext.messages).to.eql([
        `Successfully unzipped ${zipFileName}.`,
        `Successfully restored cache from ${httpServerUrl}/.cache/6ca8fb4-1.0.0.zip`,
        `Use the cache found at ${cacheDir}/collector-cache/spring-security/6ca8fb4-1.0.0`,
      ])
    })

    it('cache exists', async () => {
      contentAggregate = [createTag('1.0.0')]
      const scanDir = ospath.join(cacheDir, 'collector-cache/spring-security/6ca8fb4-1.0.0')
      // ensure the httpserver is not called
      await httpServer.shutdown()
      fs.mkdirSync(scanDir, { recursive: true })
      ext.register.call(generatorContext, { playbook })
      await generatorContext.contentAggregated({ playbook, contentAggregate })
      const actual = contentAggregate[0].origins[0].descriptor.ext
      const expected = {
        collector: {
          scan: {
            dir: scanDir,
          },
        },
      }
      expect(actual).to.eql(expected)
      expect(fs.existsSync(scanDir))
      expect(fs.existsSync(ospath.join(scanDir, 'antora.yml')))
      expect(fs.existsSync(ospath.join(scanDir, 'modules/ROOT/pages/generated.adoc')))
      expect(generatorContext.messages).to.eql([
        `Use the cache found at ${cacheDir}/collector-cache/spring-security/6ca8fb4-1.0.0`,
      ])
    })
    it('worktree defined', async () => {
      const origin = contentAggregate[0].origins[0]
      origin.worktree = origin.gitdir
      ext.register.call(generatorContext, { playbook })
      await generatorContext.contentAggregated({ playbook, contentAggregate })
      expect(fs.existsSync(origin.worktree)).to.eql(true)
    })
    it('configured cache url', async () => {
      const url = playbook.site.url
      delete playbook.site.url
      ext.register.call(generatorContext, { playbook, config: { baseCacheUrl: url } })
      await generatorContext.contentAggregated({ playbook, contentAggregate })
      expect(generatorContext.messages).to.eql([`Unable to restore cache from ${httpServerUrl}/6ca8fb4-1.0.0.zip`])
    })
  })
})
