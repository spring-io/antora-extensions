/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')
const resolvedSearch = require.resolve('@springio/antora-extensions/static-pages/search')
describe('static-page-extension', () => {
  const ext = require(packageName + '/static-page-extension')
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

  let contentAggregate
  let generatorContext
  let playbook

  beforeEach(async () => {
    generatorContext = createGeneratorContext()
    contentAggregate = [{ files: [] }]
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
    it('adds file', async () => {
      ext.register.call(generatorContext, {})
      await generatorContext.contentAggregated({ contentAggregate })
      const search = contentAggregate[0].files[0]
      // convert contents to a String so it can be compared
      search.contents = search.contents.toString()
      expect(contentAggregate).to.eql([
        {
          files: [
            {
              contents: '= Search\n:page-article: search\n\nSearch in all Spring Docs',
              path: 'modules/ROOT/pages/search.adoc',
              src: {
                abspath: resolvedSearch,
                basename: 'search.adoc',
                extname: '.adoc',
                path: 'modules/ROOT/pages/search.adoc',
                stem: 'search',
              },
            },
          ],
        },
      ])
    })
  })
})
