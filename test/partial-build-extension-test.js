/* eslint-env mocha */
'use strict'

const { cleanDir, expect, startWebServer, trapAsyncError } = require('./harness')
const fsp = require('node:fs/promises')
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
    return { listRemotes: async () => [{ remote: 'origin', url: repositoryUrl }] }
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
  let repositoryUrl

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
      repositoryUrl = 'https://github.com/org/repo'
      playbook = {
        site: {},
        asciidoc: { attributes: {} },
        content: {
          sources: [
            {
              url: repositoryUrl,
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

    const runScenario = async ({
      siteUrl,
      refname,
      version,
      rawgitUrl,
      attributes,
      expectedRefs,
      expectedOutput,
      initWorktree,
    }) => {
      const expected = [Object.assign({}, playbook.content.sources[0], expectedRefs)]
      attributes ??= { 'primary-site-manifest-url': ospath.join(FIXTURES_DIR, 'site-manifest.json') }
      if (siteUrl) playbook.site.url = siteUrl
      playbook.dir = WORK_DIR
      if (initWorktree) {
        if (initWorktree === 'linked') {
          playbook.dir = ospath.join(WORK_DIR, 'docs-build')
          const mainWorktreeDir = ospath.join(WORK_DIR, 'main')
          const gitdir = ospath.join(mainWorktreeDir, '.git/worktrees/docs-build')
          await fsp.mkdir(playbook.dir)
          await fsp.writeFile(ospath.join(playbook.dir, '.git'), `gitdir: ${gitdir}\n`, 'utf-8')
          await fsp.mkdir(gitdir, { recursive: true })
          await fsp.writeFile(ospath.join(gitdir, 'commondir'), '../..\n', 'utf-8')
        } else {
          await fsp.mkdir(ospath.join(WORK_DIR, '.git'))
        }
      }
      Object.assign(playbook.asciidoc.attributes, attributes)
      const config = {}
      if (refname) config.refname = refname
      if (version) config.version = version
      if (rawgitUrl) config.rawgitUrl = rawgitUrl
      ext.register.call(generatorContext, Object.keys(config).length ? { config } : {})
      generatorContext.updateVariables({ playbook })
      await generatorContext.playbookBuilt(generatorContext.variables)
      if (initWorktree) await fsp.rm(ospath.join(playbook.dir, '.git'), { recursive: true })
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
        ).to.throw(`${httpServerUrl}/no-such-manifest.json returned response code 404 (Not Found)`)
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
          initWorktree: true,
        })
      })

      it('should extract repository path from non-https repository URL with .git file extension', async () => {
        playbook.content.sources[0].url = repositoryUrl = 'git@github.com:org/repo.git'
        await runScenario({
          refname: '6.0.0',
          rawgitUrl: httpServerUrl,
          expectedRefs: { branches: [], tags: ['6.0.0'] },
          initWorktree: true,
        })
      })

      it('should look up version in git repository with linked worktree if not specified', async () => {
        playbook.content.sources[0].url = repositoryUrl = 'https://git@gitlab.com/org/repo.git'
        await runScenario({
          refname: '6.0.0',
          rawgitUrl: httpServerUrl,
          expectedRefs: { branches: [], tags: ['6.0.0'] },
          initWorktree: 'linked',
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
        await runScenario({ refname: '6.0.0', expectedRefs: { branches: [], tags: ['6.0.0'] }, initWorktree: true })
        expect(simpleGet.requests).to.eql(['https://raw.githubusercontent.com/org/repo/6.0.0/gradle.properties'])
      })
    })
  })
})
