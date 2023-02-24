/* eslint-env mocha */
'use strict'

const { expect, trapAsyncError } = require('./harness')
const ospath = require('node:path')
const { name: packageName } = require('#package')

const FIXTURES_DIR = ospath.join(__dirname, 'fixtures')

describe('publish-docsearch-config-extension', () => {
  const ext = require(packageName + '/publish-docsearch-config-extension')

  const createComponents = () => {
    const component = {
      versions: [
        {
          version: '6.1.0',
          name: 'spring-security',
          versionSegment: '6.1',
          activeVersionSegment: '6.1',
        },
      ],
    }
    component.latest = component.versions[0]

    return [component]
  }
  const createContentCatalog = () => ({
    components: createComponents(),
    pages: [],
    getComponentsSortedBy (property) {
      return this.components.slice(0).sort((a, b) => a[property].localeCompare(b[property]))
    },
    getPages (filter) {
      return filter ? this.pages.filter(filter) : this.pages.slice()
    },
  })

  const createSiteCatalog = () => ({
    files: {},
    addFile ({ contents, out }) {
      return (this.files[out.path] = contents)
    },
  })

  const createGeneratorContext = () => ({
    variables: {},
    once (eventName, fn) {
      this[eventName] = fn
    },
    on (eventName, fn) {
      this[eventName] = fn
    },
    require,
    updateVariables (updates) {
      Object.assign(this.variables, updates)
    },
  })

  const run = async (config = {}) => {
    ext.register.call(generatorContext, { config })
    await generatorContext.beforePublish({ playbook, contentCatalog, siteCatalog })
    return JSON.parse(siteCatalog.files['docsearch-config.json'].toString())
  }

  let generatorContext
  let playbook
  let contentCatalog
  let siteCatalog

  beforeEach(() => {
    generatorContext = createGeneratorContext()
    playbook = {
      site: { url: 'https://docs.spring.io/spring-security/reference' },
      dir: FIXTURES_DIR,
      asciidoc: { extensions: ['@asciidoctor/tabs'] },
    }
    contentCatalog = createContentCatalog()
    siteCatalog = createSiteCatalog()
  })

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension', () => {
      ext.register.call(generatorContext, { config: {} })
      expect(generatorContext.beforePublish).to.be.instanceOf(Function)
    })
  })

  describe('generate config', () => {
    it('latest snapshot start url generated correctly', async () => {
      const config = await run()
      const expectedStartUrls = [
        {
          url: 'https://docs.spring.io/spring-security/reference/6.1/',
          extra_attributes: { component: 'spring-security', version: '6.1.0', version_rank: 2 },
        },
      ]
      expect(config.start_urls).to.eql(expectedStartUrls)
    })

    it('Latest release start url generated correctly', async () => {
      contentCatalog.components[0].versions[0].activeVersionSegment = ''
      const config = await run()
      const expectedStartUrls = [
        {
          url: 'https://docs.spring.io/spring-security/reference/(?:$|index.html$|[a-z].*)',
          extra_attributes: { component: 'spring-security', version: '6.1.0', version_rank: 1 },
        },
      ]
      expect(config.start_urls).to.eql(expectedStartUrls)
    })

    it('content catalog contains no versions to index', async () => {
      delete contentCatalog.components[0].versions[0].versionSegment
      expect(await trapAsyncError(run)).to.throw(Error, 'The content catalog does not contain any versions to index.')
    })

    it('ROOT component fails if not configured', async () => {
      contentCatalog.components[0].versions[0].name = 'ROOT'

      expect(await trapAsyncError(run)).to.throw(Error, 'Found ROOT component but rootComponentName not defined')
    })

    it('ROOT component works if configured', async () => {
      const expectedComponentName = 'security'
      contentCatalog.components[0].versions[0].name = 'ROOT'
      const config = await run({ rootComponentName: expectedComponentName })
      expect(config.start_urls[0].extra_attributes.component).to.equal(expectedComponentName)
    })

    it('default index_name generated correctly', async () => {
      contentCatalog.components[0].versions[0].activeVersionSegment = ''
      const config = await run()
      expect(config.index_name).to.eql('spring-security-docs')
    })

    it('configured index_name generated correctly', async () => {
      const expectedIndexName = 'custom-index-name'
      const config = await run({ indexName: expectedIndexName })
      expect(config.index_name).to.eql(expectedIndexName)
    })

    it('custom templatePath generated correctly', async () => {
      const config = await run({ templatePath: './custom-docsearch-config.json.hbs' })
      expect(config).to.eql({ custom: 'template' })
    })

    it('stop pages when archived', async () => {
      const stopUrl = '/index.html'
      contentCatalog.pages.push({
        out: 'content',
        asciidoc: { attributes: { 'page-archived': true } },
        pub: { url: stopUrl },
      })
      const config = await run()
      expect(config.stop_urls).to.eql([`${playbook.site.url}${stopUrl}`])
    })

    it('stop pages when page-noindex', async () => {
      const stopUrl = '/index.html'
      contentCatalog.pages.push({
        out: 'content',
        asciidoc: { attributes: { 'page-noindex': true } },
        pub: { url: stopUrl },
      })
      const config = await run()
      expect(config.stop_urls).to.eql([`${playbook.site.url}${stopUrl}`])
    })
  })
})
