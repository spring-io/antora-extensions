/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')

describe('root-component-extension', () => {
  const ext = require(packageName + '/root-component-extension')

  const createContentCatalog = () => ({
    files: [],
    component: { versions: [] },
    findBy () {
      return this.files
    },
    getComponent () {
      return this.component
    },
  })

  const createGeneratorContext = () => ({
    variables: {},
    once (eventName, fn) {
      this[eventName] = fn
    },
    updateVariables (updates) {
      Object.assign(this.variables, updates)
    },
  })

  const run = (config = { rootComponentName: 'framework' }) => {
    ext.register.call(generatorContext, config ? { config } : {})
    return generatorContext.contentClassified({ contentCatalog })
  }

  let generatorContext
  let contentCatalog

  beforeEach(() => {
    generatorContext = createGeneratorContext()
    contentCatalog = createContentCatalog()
  })

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension', () => {
      ext.register.call(generatorContext, {})
      expect(generatorContext.contentClassified).to.be.instanceOf(Function)
    })
  })

  describe('contentClassified', () => {
    it('root component name is required', () => {
      expect(() => run({})).to.throw(
        'Missing required configuration attribute root_component_name for root-component-extension'
      )
    })
    it('pub.url when no out', () => {
      contentCatalog.files.push({
        pub: {
          url: '/framework/',
        },
      })
      run()
      expect(contentCatalog.files).is.eqls([
        {
          pub: {
            url: '/',
          },
        },
      ])
    })
    it('when out and pub', () => {
      contentCatalog.files.push({
        out: {
          dirname: '/framework',
          path: '/framework/attributes.html',
          rootPath: '..',
        },
        pub: {
          url: '/framework/appendix.html',
          rootPath: '..',
        },
      })
      run()
      expect(contentCatalog.files).is.eqls([
        {
          out: {
            dirname: '',
            path: '/attributes.html',
            rootPath: '.',
          },
          pub: {
            rootPath: '.',
            url: '/appendix.html',
          },
        },
      ])
    })

    it('when out and pub no rootComponentName', () => {
      contentCatalog.files.push({
        out: {
          dirname: '',
          path: '/attributes.html',
          rootPath: '.',
        },
        pub: {
          url: '/appendix.html',
          rootPath: '.',
        },
      })
      run()
      expect(contentCatalog.files).is.eqls([
        {
          out: {
            dirname: '',
            path: '/attributes.html',
            rootPath: '.',
          },
          pub: {
            rootPath: '.',
            url: '/appendix.html',
          },
        },
      ])
    })

    it('when out and pub rootComponentName/', () => {
      contentCatalog.files.push({
        out: {
          dirname: '',
          path: 'framework/attributes.html',
          rootPath: '..',
        },
        pub: {
          url: 'framework/appendix.html',
          rootPath: '..',
        },
      })
      run()
      expect(contentCatalog.files).is.eqls([
        {
          out: {
            dirname: '',
            path: 'attributes.html',
            rootPath: '.',
          },
          pub: {
            rootPath: '.',
            url: 'appendix.html',
          },
        },
      ])
    })

    it('when out and pub /rootComponentName + NO', () => {
      contentCatalog.files.push({
        out: {
          dirname: '',
          path: 'frameworkNO/attributes.html',
          rootPath: '..',
        },
        pub: {
          url: 'frameworkNO/appendix.html',
          rootPath: '..',
        },
      })
      run()
      expect(contentCatalog.files).is.eqls([
        {
          out: {
            dirname: '',
            path: 'frameworkNO/attributes.html',
            rootPath: '..',
          },
          pub: {
            rootPath: '..',
            url: 'frameworkNO/appendix.html',
          },
        },
      ])
    })

    it('when nested directories', () => {
      contentCatalog.files.push({
        out: {
          dirname: '/framework/core',
          path: '/framework/core/aop.html',
          rootPath: '../..',
        },
        pub: {
          url: '/framework/core/aot.html',
          rootPath: '..',
        },
      })
      run()
      expect(contentCatalog.files).is.eqls([
        {
          out: {
            dirname: '/core',
            path: '/core/aop.html',
            rootPath: '..',
          },
          pub: {
            rootPath: '.',
            url: '/core/aot.html',
          },
        },
      ])
    })

    it('when nested 3 directories', () => {
      contentCatalog.files.push({
        out: {
          dirname: '/framework/core/aop',
          path: '/framework/core/aop/ataspectj.html',
          rootPath: '../../..',
        },
        pub: {
          url: '/framework/core/aop/ataspectj.html',
          rootPath: '../../..',
        },
      })
      run()
      expect(contentCatalog.files).is.eqls([
        {
          out: {
            dirname: '/core/aop',
            path: '/core/aop/ataspectj.html',
            rootPath: '../..',
          },
          pub: {
            rootPath: '../..',
            url: '/core/aop/ataspectj.html',
          },
        },
      ])
    })
    it('when no out, pub, rel', () => {
      contentCatalog.files.push({})
      run()
      // no errors
    })
    it('rel and no rel.pub', () => {
      contentCatalog.files.push({ rel: {} })
      run()
      // no errors
    })
    it('when rel', () => {
      contentCatalog.files.push({
        pub: {
          url: '/framework/6.0',
          rootPath: '../..',
        },
        rel: {
          pub: {
            url: '/framework',
            rootPath: '..',
          },
        },
      })
      run()
      expect(contentCatalog.files).is.eqls([
        {
          pub: {
            url: '/6.0',
            rootPath: '..',
          },
          rel: {
            pub: {
              url: '/',
              rootPath: '.',
            },
          },
        },
      ])
    })

    it('versions updated on root component when no version segment', () => {
      contentCatalog.component.versions.push({ url: '/framework/index.html' })
      run()
      expect(contentCatalog.component.versions).is.eqls([{ url: '/index.html' }])
    })

    it('versions updated on root component when version segment', () => {
      contentCatalog.component.versions.push({ url: '/framework/6.0/index.html' })
      run()
      expect(contentCatalog.component.versions).is.eqls([{ url: '/6.0/index.html' }])
    })
  })
})
