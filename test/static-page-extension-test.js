/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')
const resolvedSearch = require.resolve('@springio/antora-extensions/static-pages/search')
const resolvedSpringProjects = require.resolve('@springio/antora-extensions/static-pages/spring-projects')
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
    it('adds files', async () => {
      ext.register.call(generatorContext, {})
      await generatorContext.contentAggregated({ contentAggregate })
      for (const f of contentAggregate[0].files) {
        // convert contents to a String so it can be compared
        f.contents = f.contents.toString()
      }
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
            {
              contents: '= Spring Projects\n:page-article: spring-projects\n\nList all Spring Projects',
              path: 'modules/ROOT/pages/spring-projects.adoc',
              src: {
                abspath: resolvedSpringProjects,
                basename: 'spring-projects.adoc',
                extname: '.adoc',
                path: 'modules/ROOT/pages/spring-projects.adoc',
                stem: 'spring-projects',
              },
            },
          ],
        },
      ])
    })
  })
})
