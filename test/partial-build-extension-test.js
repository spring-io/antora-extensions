/* eslint-env mocha */
'use strict'

const { cleanDir, expect, startWebServer, trapAsyncError } = require('./harness')
const ospath = require('node:path')
const { name: packageName } = require('#package')

const FIXTURES_DIR = ospath.join(__dirname, 'fixtures')
const WORK_DIR = ospath.join(__dirname, 'work')

describe('partial-build-extension', () => {
  const ext = require(packageName + '/partial-build-extension')

  const createGeneratorContext = () => ({
    variables: {},
    once (eventName, fn) {
      this[eventName] = fn
    },
    require (request) {
      if (request === 'isomorphic-git') return createIsomorphicGitStub()
      return require(request)
    },
    updateVariables (updates) {
      Object.assign(this.variables, updates)
    },
  })

  const createIsomorphicGitStub = () => {
    return { listRemotes: async () => [{ remote: 'origin', url: 'https://github.com/org/repo' }] }
  }

  const withEnv = async (env, cb) => {
    const oldEnv = process.env
    try {
      process.env = Object.assign({}, oldEnv, env)
      await cb()
    } finally {
      process.env = oldEnv
    }
  }

  let generatorContext
  let playbook

  beforeEach(() => {
    generatorContext = createGeneratorContext()
  })

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension if refname and version are set', () => {
      ext.register.call(generatorContext, { config: { refname: 'main', version: '1.0.0-SNAPSHOT' } })
      expect(generatorContext.playbookBuilt).to.be.instanceOf(Function)
    })

    it('should register listener if only refname key is set', () => {
      ext.register.call(generatorContext, { config: { refname: 'main' } })
      expect(generatorContext.playbookBuilt).to.be.instanceOf(Function)
    })

    it('should not register listener if refname key is not set', () => {
      ext.register.call(generatorContext, {})
      expect(generatorContext.playbookBuilt).to.be.undefined()
    })
  })

  describe('configure partial build', () => {
    let output

    beforeEach(async () => {
      playbook = {
        site: {},
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
      }
      await cleanDir(WORK_DIR, { create: true })
      console.log_ = console.log.bind(console)
      output = []
      console.log = output.push.bind(output)
    })

    afterEach(() => {
      console.log = console.log_
      delete console.log_
    })

    after(() => cleanDir(WORK_DIR))

    const runScenario = async ({ siteUrl, refname, version, rawgitUrl, attributes, expectedRefs, expectedOutput }) => {
      const expected = [Object.assign({}, playbook.content.sources[0], expectedRefs)]
      attributes ??= { 'primary-site-manifest-url': ospath.join(FIXTURES_DIR, 'site-manifest.json') }
      if (siteUrl) playbook.site.url = siteUrl
      playbook.dir = WORK_DIR
      Object.assign(playbook.asciidoc.attributes, attributes)
      const config = {}
      if (refname) config.refname = refname
      if (version) config.version = version
      if (rawgitUrl) config.rawgitUrl = rawgitUrl
      ext.register.call(generatorContext, Object.keys(config).length ? { config } : {})
      generatorContext.updateVariables({ playbook })
      await generatorContext.playbookBuilt(generatorContext.variables)
      expect(playbook.content.sources).to.eql(expected)
      if (expectedRefs) {
        expect(playbook.asciidoc.attributes['primary-site-url']).to.equal('.')
        expect(playbook.dir).to.be.a.directory().and.empty()
      } else {
        expect(playbook.asciidoc.attributes).to.not.have.property('primary-site-url')
        expect(ospath.join(playbook.dir, '.full-build')).to.be.a.path()
      }
      if (expectedOutput) expect(output).to.eql(expectedOutput)
    }

    it('should rewrite content sources if refname is branch and version exists in site manifest', async () => {
      await runScenario({ refname: 'main', version: '6.1.0-SNAPSHOT', expectedRefs: { branches: ['main'], tags: [] } })
    })

    it('should rewrite content sources if refname is tag and version exists in site manifest', async () => {
      await runScenario({ refname: '6.0.0', version: '6.0.0', expectedRefs: { branches: [], tags: ['6.0.0'] } })
    })

    it('should use refname and version defined by BUILD_REFNAME and BUILD_VERSION environment variables', async () => {
      const env = { BUILD_REFNAME: '6.1.x', BUILD_VERSION: '6.1.0-SNAPSHOT' }
      await withEnv(env, () => runScenario({ expectedRefs: { branches: ['6.1.x'], tags: [] } }))
    })

    it('should touch .full-build file if version is not in site manifest', async () => {
      const expectedOutput = ['partial-build-extension: version 6.0.1 not previously built; reverting to full build']
      await runScenario({ refname: '6.0.1', version: '6.0.1', expectedOutput })
    })

    it('should touch .full-build file if prerelease state differs from site manifest', async () => {
      const expectedOutput = ['partial-build-extension: version 6.1.0 not previously built; reverting to full build']
      await runScenario({ refname: '6.1.0', version: '6.1.0', expectedOutput })
    })

    describe('remote', () => {
      let httpServer, httpServerUrl

      beforeEach(async () => {
        ;[httpServer, httpServerUrl] = await startWebServer('localhost', FIXTURES_DIR)
      })

      afterEach(async () => {
        if (httpServer.listening) await httpServer.shutdown()
      })

      it('should download site manifest from primary-site-manifest-url if value is URL', async () => {
        await runScenario({
          siteUrl: httpServerUrl,
          attributes: { 'primary-site-manifest-url': `${httpServerUrl}/site-manifest.json` },
          refname: 'main',
          version: '6.1.0-SNAPSHOT',
          expectedRefs: { branches: ['main'], tags: [] },
        })
      })

      it('should download site manifest from primary site if primary-site-manifest-url is not specified', async () => {
        await runScenario({
          siteUrl: httpServerUrl,
          attributes: {},
          refname: 'main',
          version: '6.1.0-SNAPSHOT',
          expectedRefs: { branches: ['main'], tags: [] },
        })
      })

      it('should throw error if site manifest is not found in primary site', async () => {
        expect(
          await trapAsyncError(() =>
            runScenario({
              siteUrl: httpServerUrl,
              attributes: { 'primary-site-manifest-url': `${httpServerUrl}/no-such-manifest.json` },
              refname: 'main',
              version: '6.1.0-SNAPSHOT',
            })
          )
        ).to.throw('404')
      })

      it('should throw error when downloading playbook from primary site if connect refused', async () => {
        await httpServer.shutdown()
        expect(
          await trapAsyncError(() =>
            runScenario({
              siteUrl: httpServerUrl,
              attributes: { 'primary-site-manifest-url': `${httpServerUrl}/no-such-manifest.json` },
              refname: 'main',
              version: '6.1.0-SNAPSHOT',
            })
          )
        ).to.throw('connect ECONNREFUSED')
      })

      it('should look up version in git repository if not specified', async () => {
        await runScenario({
          refname: '6.0.0',
          rawgitUrl: httpServerUrl,
          expectedRefs: { branches: [], tags: ['6.0.0'] },
        })
      })

      it('should use raw.githubusercontent.com by default when retrieving file from git repository', async () => {
        const oldRequire = generatorContext.require
        let simpleGet
        generatorContext.require = (request) => {
          if (request !== 'simple-get') return oldRequire(request)
          if (simpleGet) return simpleGet
          simpleGet = require('simple-get')
          simpleGet.requests = []
          simpleGet.concat = new Proxy(simpleGet.concat, {
            apply (target, self, args) {
              const arg0 = args[0]
              simpleGet.requests.push(arg0.url)
              arg0.url = httpServerUrl + new URL(arg0.url).pathname
              return target.apply(self, args)
            },
          })
          return simpleGet
        }
        await runScenario({ refname: '6.0.0', expectedRefs: { branches: [], tags: ['6.0.0'] } })
        expect(simpleGet.requests).to.eql(['https://raw.githubusercontent.com/org/repo/6.0.0/gradle.properties'])
      })
    })
  })
})
