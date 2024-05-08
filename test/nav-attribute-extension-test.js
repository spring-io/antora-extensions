/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')

describe('nav-attributes-extension', () => {
  const ext = require(packageName + '/nav-attributes-extension')

  let generatorContext
  let contentAggregate
  let contentCatalog

  const createGeneratorContext = () => ({
    messages: [],
    once (eventName, fn) {
      this[eventName] = fn
    },
    getLogger (name) {
      const messages = this.messages
      const appendMessage = function (message) {
        messages.push(message)
      }
      return {
        info: appendMessage,
        debug: appendMessage,
        trace: appendMessage,
      }
    },
  })

  beforeEach(() => {
    generatorContext = createGeneratorContext()
    contentAggregate = [
      {
        version: '1.2.3',
        name: 'test',
        origins: [
          {
            descriptor: {
              ext: {},
            },
          },
        ],
        files: [],
      },
    ]
    contentCatalog = {
      components: [{ versions: [{ name: 'test', version: '1.2.3' }] }],
      getComponents () {
        return this.components
      },
    }
  })

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension', () => {
      ext.register.call(generatorContext, { config: {} })
      expect(generatorContext.navigationBuilt).to.be.instanceOf(Function)
    })
  })

  describe('integration', () => {
    it('should add attributes to navigation', () => {
      const navAttributes = [
        {
          path: 'Welcome',
          attributes: { foo: 'bar' },
        },
      ]
      const navigation = [{ content: 'Welcome' }]
      contentAggregate[0].origins[0].descriptor.ext.navAttributes = navAttributes
      contentCatalog.components[0].versions[0].navigation = navigation
      ext.register.call(generatorContext, { config: {} })
      generatorContext.contentAggregated({ contentAggregate })
      contentCatalog.navigation = navigation
      generatorContext.navigationBuilt({ contentCatalog })
      expect(navigation[0].foo).to.equal('bar')
    })

    it('should add attributes to navigation when nested in root', () => {
      const navAttributes = [
        {
          path: 'Welcome',
          attributes: { foo: 'bar' },
        },
      ]
      const navigation = [{ items: [{ content: 'Welcome' }], root: true }]
      contentAggregate[0].origins[0].descriptor.ext.navAttributes = navAttributes
      contentCatalog.components[0].versions[0].navigation = navigation
      ext.register.call(generatorContext, { config: {} })
      generatorContext.contentAggregated({ contentAggregate })
      contentCatalog.navigation = navigation
      generatorContext.navigationBuilt({ contentCatalog })
      expect(navigation[0].items[0].foo).to.equal('bar')
    })

    it('should add attributes to navigation when nested path', () => {
      const navAttributes = [
        {
          path: ['Welcome', 'Home'],
          attributes: { foo: 'bar' },
        },
      ]
      const navigation = [{ items: [{ content: 'Welcome', items: [{ content: 'Home' }] }], root: true }]
      contentAggregate[0].origins[0].descriptor.ext.navAttributes = navAttributes
      contentCatalog.components[0].versions[0].navigation = navigation
      ext.register.call(generatorContext, { config: {} })
      generatorContext.contentAggregated({ contentAggregate })
      contentCatalog.navigation = navigation
      generatorContext.navigationBuilt({ contentCatalog })
      expect(navigation[0].items[0].items[0].foo).to.equal('bar')
    })

    it('should add multiple attributes to navigation', () => {
      const navAttributes = [
        {
          path: 'Welcome',
          attributes: { foo: 'bar' },
        },
        {
          path: 'Welcome',
          attributes: { ascii: 'doctor' },
        },
      ]
      const navigation = [{ content: 'Welcome' }]
      contentAggregate[0].origins[0].descriptor.ext.navAttributes = navAttributes
      contentCatalog.components[0].versions[0].navigation = navigation
      ext.register.call(generatorContext, { config: {} })
      generatorContext.contentAggregated({ contentAggregate })
      contentCatalog.navigation = navigation
      generatorContext.navigationBuilt({ contentCatalog })
      expect(navigation[0].foo).to.equal('bar')
      expect(navigation[0].ascii).to.equal('doctor')
    })

    it('should fail if attribute already defined', () => {
      const navAttributes = [
        {
          path: 'Welcome',
          attributes: { foo: 'bar' },
        },
      ]
      const navigation = [{ content: 'Welcome' }]
      contentAggregate[0].origins[0].descriptor.ext.navAttributes = navAttributes
      contentCatalog.components[0].versions[0].navigation = navigation
      navigation[0].foo = 'bar'
      ext.register.call(generatorContext, { config: {} })
      generatorContext.contentAggregated({ contentAggregate })
      contentCatalog.navigation = navigation
      expect(() => generatorContext.navigationBuilt({ contentCatalog })).to.throws('not applied due to existing name')
    })

    it('should fail early if banned word', () => {
      const navAttributes = [
        {
          path: 'Welcome',
          attributes: { content: 'bar' },
        },
      ]
      const navigation = [{ content: 'Welcome' }]
      contentAggregate[0].origins[0].descriptor.ext.navAttributes = navAttributes
      contentCatalog.components[0].versions[0].navigation = navigation
      navigation[0].foo = 'bar'
      ext.register.call(generatorContext, { config: {} })
      expect(() => generatorContext.contentAggregated({ contentAggregate })).to.throws('contains banned names')
    })

    it('should fail if path not found', () => {
      const navAttributes = [
        {
          path: 'Hello',
          attributes: { foo: 'bar' },
        },
      ]
      const navigation = [{ content: 'Welcome' }]
      contentAggregate[0].origins[0].descriptor.ext.navAttributes = navAttributes
      contentCatalog.components[0].versions[0].navigation = navigation
      navigation[0].foo = 'bar'
      ext.register.call(generatorContext, { config: {} })
      generatorContext.contentAggregated({ contentAggregate })
      contentCatalog.navigation = navigation
      expect(() => generatorContext.navigationBuilt({ contentCatalog })).to.throws('Unable to find navigation item ')
    })
  })
})
