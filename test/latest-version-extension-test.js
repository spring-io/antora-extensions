/* eslint-env mocha */
'use strict'

const { expect, trapAsyncError } = require('./harness')
const { name: packageName } = require('#package')

describe('latest-version-extension', () => {
  const ext = require(packageName + '/latest-version-extension')

  const createTag = (ref, componentName = 'componentName') => {
    return {
      name: componentName,
      origins: [
        {
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
          reftype: 'branch',
          refname: ref,
          branch: ref,
        },
      ],
    }
  }

  const createContentCatalog = (versions) => ({
    getComponents () {
      return [{ versions }]
    },
  })

  const createVersion = (version, prerelease) => {
    return prerelease
      ? {
          version,
          prerelease,
        }
      : {
          version,
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
      return {
        info (message) {
          messages.push(message)
        },
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

  const mapContentAggregateToRefname = async (config = {}) => {
    await runContentAggregate({ contentAggregate })
    return contentAggregate.map((c) => c.origins[0].refname)
  }

  const runComponentsRegistered = async (config = {}) => {
    ext.register.call(generatorContext, { config })
    await generatorContext.componentsRegistered({ contentCatalog })
    return contentCatalog.getComponents().map((c) =>
      c.versions.map((v) => {
        const version = v.version
        const versionSegment = v.versionSegment
        return { version, versionSegment }
      })
    )
  }

  let contentAggregate
  let generatorContext
  let contentCatalog

  beforeEach(() => {
    generatorContext = createGeneratorContext()
    contentAggregate = [createBranch('main'), createBranch('6.0.x'), createTag('6.0.1'), createTag('6.0.2')]
  })

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension', () => {
      ext.register.call(generatorContext, { config: {} })
      expect(generatorContext.contentAggregated).to.be.instanceOf(Function)
    })
  })

  describe('filter older versions', () => {
    it('all branches are retained', async () => {
      const refnames = await mapContentAggregateToRefname()
      expect(refnames).to.eql(['main', '6.0.x', '6.0.2'])
    })

    it('handles double digit tags', async () => {
      contentAggregate = [createTag('5.6.8'), createTag('5.6.10'), createTag('5.6.9')]
      const refnames = await mapContentAggregateToRefname()
      expect(refnames).to.eql(['5.6.10'])
    })

    it('handles tags prefixed with v', async () => {
      contentAggregate = [createTag('v6.0.1'), createTag('v6.0.0')]
      const refnames = await mapContentAggregateToRefname()
      expect(refnames).to.eql(['v6.0.1'])
    })

    it('handles mixed tags prefixed with v', async () => {
      contentAggregate = [createTag('6.0.0'), createTag('v6.0.1'), createTag('v6.0.1')]
      const refnames = await mapContentAggregateToRefname()
      expect(refnames).to.eql(['v6.0.1'])
    })

    it('handles milestones', async () => {
      contentAggregate = [createTag('6.0.0'), createTag('6.0.0-M1')]
      const refnames = await mapContentAggregateToRefname()
      expect(refnames).to.eql(['6.0.0'])
    })

    it('milestones handles minor versions', async () => {
      contentAggregate = [createTag('6.0.0-M1'), createTag('6.1.0-M1')]
      const refnames = await mapContentAggregateToRefname()
      expect(refnames).to.eql(['6.0.0-M1', '6.1.0-M1'])
    })

    it('milestones handles major versions', async () => {
      contentAggregate = [createTag('6.0.0-M1'), createTag('7.0.0-M1')]
      const refnames = await mapContentAggregateToRefname()
      expect(refnames).to.eql(['6.0.0-M1', '7.0.0-M1'])
    })

    it('handles release candidate', async () => {
      contentAggregate = [
        createTag('6.0.0-M3'),
        createTag('6.0.0-M2'),
        createTag('6.0.0'),
        createTag('6.0.0-M2'),
        createTag('6.0.0-RC1'),
      ]
      const refnames = await mapContentAggregateToRefname()
      expect(refnames).to.eql(['6.0.0'])
    })

    it('handles multiple component names', async () => {
      contentAggregate = [createTag('6.0.0-M3', 'componentA'), createTag('6.0.0-M3', 'componentB')]
      await runContentAggregate()
      const refnameAndComponentName = (c) => {
        const result = {
          name: c.name,
          refname: c.origins[0].refname,
        }
        return result
      }
      expect(contentAggregate.map(refnameAndComponentName)).to.eql([
        { name: 'componentA', refname: '6.0.0-M3' },
        { name: 'componentB', refname: '6.0.0-M3' },
      ])
    })

    it('handles invalid version format with proper message', async () => {
      contentAggregate = [createTag('6.0.0-M3-m')]
      expect(await trapAsyncError(runContentAggregate)).to.throw(
        'Cannot parse version = 6.0.0-M3-m with regex /^v?(\\d+)\\.(\\d+)\\.(\\d+)(?:-(RC|M)(\\d+))?$/'
      )
    })
  })

  describe('version segments set', () => {
    it('snapshot is mapped properly', async () => {
      contentCatalog = createContentCatalog([createVersion('6.0.0'), createVersion('6.1.0', '-SNAPSHOT')])
      const versions = await runComponentsRegistered()
      expect(versions).to.eql([
        [
          { version: '6.0.0', versionSegment: '6.0' },
          { version: '6.1.0', versionSegment: '6.1-SNAPSHOT' },
        ],
      ])
    })

    it('milestone is mapped properly', async () => {
      contentCatalog = createContentCatalog([createVersion('6.1.0-M1', true), createVersion('6.1.0', '-SNAPSHOT')])
      const versions = await runComponentsRegistered()
      expect(versions).to.eql([
        [
          { version: '6.1.0-M1', versionSegment: '6.1' },
          { version: '6.1.0', versionSegment: '6.1-SNAPSHOT' },
        ],
      ])
    })

    it('rc is mapped properly', async () => {
      contentCatalog = createContentCatalog([createVersion('6.1.0-RC1', true), createVersion('6.1.0', '-SNAPSHOT')])
      const versions = await runComponentsRegistered()
      expect(versions).to.eql([
        [
          { version: '6.1.0-RC1', versionSegment: '6.1' },
          { version: '6.1.0', versionSegment: '6.1-SNAPSHOT' },
        ],
      ])
    })
  })
})
