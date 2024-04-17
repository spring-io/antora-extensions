/* eslint-env mocha */
'use strict'

const { expect, heredoc } = require('./harness')
const { name: packageName } = require('#package')
const Asciidoctor = require('@asciidoctor/core')
const asciidoctor = Asciidoctor()

describe('asciinema-extension', () => {
  const ext = require(packageName + '/asciinema-extension')

  let generatorContext
  let playbook
  let siteAsciiDocConfig
  let uiCatalog
  let contentCatalog

  const addPage = (contents, publishable = true) => {
    contents = Buffer.from(contents)
    const mediaType = 'text/asciidoc'
    const page = publishable ? { contents, mediaType, out: {} } : { contents, mediaType }
    contentCatalog.pages.push(page)
    return page
  }

  const createSiteAsciiDocConfig = () => ({
    extensions: [],
  })

  const createUiCatalog = () => ({
    files: [],
    addFile (f) {
      if (this.files.some(({ path }) => path === f.path)) {
        throw new Error('duplicate file')
      }
      this.files.push(f)
    },
    findByType (t) {
      return this.files.filter(({ type }) => type === t)
    },
  })

  const createContentCatalog = () => ({
    pages: [],
    partials: [],
    getPages (filter) {
      return filter ? this.pages.filter(filter) : this.pages.slice()
    },
    findBy () {
      return this.partials
    },
  })

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

  beforeEach(() => {
    generatorContext = createGeneratorContext()
    playbook = {
      env: {},
      ui: {
        outputDir: 'out',
      },
    }
    siteAsciiDocConfig = createSiteAsciiDocConfig()
    contentCatalog = createContentCatalog()
    uiCatalog = createUiCatalog()
  })

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension', () => {
      ext.register.call(generatorContext, { config: {} })
      expect(generatorContext.uiLoaded).to.be.instanceOf(Function)
      expect(generatorContext.contentClassified).to.be.instanceOf(Function)
    })

    it('should fail with unknown option', () => {
      expect(() => ext.register.call(generatorContext, { config: { foo: 'bar' } })).to.throws(
        'Unrecognized option specified for @springio/antora-extensions: foo'
      )
      expect(generatorContext.messages).to.eql([])
    })
  })

  describe('uiLoaded', () => {
    it('should add js, css, helpers and templates', async () => {
      ext.register.call(generatorContext, { config: {} })
      generatorContext.updateVariables({ contentCatalog, playbook, siteAsciiDocConfig, uiCatalog })
      await generatorContext.uiLoaded(generatorContext.variables)
      expect(uiCatalog.files.length).to.equal(7)
    })
  })

  describe('contentClassified', () => {
    it('should migrate asciinema block', async () => {
      const input = heredoc`
      [asciinema]
      ----
      foobar
      ----
      `
      addPage(input)

      ext.register.call(generatorContext, { config: {} })
      generatorContext.updateVariables({ contentCatalog, siteAsciiDocConfig, uiCatalog })
      await generatorContext.contentClassified(generatorContext.variables)

      const registry = asciidoctor.Extensions.create()
      siteAsciiDocConfig.extensions[0].register.call({}, registry, { file: { asciidoc: { attributes: {} } } })
      const out = asciidoctor.convert(input, { extension_registry: registry })

      expect(siteAsciiDocConfig.extensions.length).to.equal(1)
      expect(uiCatalog.files.length).to.equal(1)
      expect(out).to.contains('video')
    })

    it('should work with duplicate blocks', async () => {
      const input = heredoc`
      [asciinema]
      ----
      foobar
      ----

      [asciinema]
      ----
      foobar
      ----
      `
      addPage(input)

      ext.register.call(generatorContext, { config: {} })
      generatorContext.updateVariables({ contentCatalog, siteAsciiDocConfig, uiCatalog })
      await generatorContext.contentClassified(generatorContext.variables)

      const registry = asciidoctor.Extensions.create()
      siteAsciiDocConfig.extensions[0].register.call({}, registry, { file: { asciidoc: { attributes: {} } } })
      const out = asciidoctor.convert(input, { extension_registry: registry })

      expect(siteAsciiDocConfig.extensions.length).to.equal(1)
      expect(uiCatalog.files.length).to.equal(1)
      expect(out).to.contains('video')
    })
  })
})
