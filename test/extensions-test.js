/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')

describe('extensions', () => {
  const ext = require(packageName)

  const createGeneratorContext = () => ({
    required: [],
    once (eventName, fn) {
      this[eventName] = fn
    },
    require (request) {
      this.required.push(request)
      return {
        register: function (args) {},
      }
    },
  })

  let generatorContext

  beforeEach(() => {
    generatorContext = createGeneratorContext()
  })

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension', () => {
      ext.register.call(generatorContext, {})
      expect(generatorContext.required).eql([
        `${packageName}/set-algolia-env-extension`,
        `${packageName}/partial-build-extension`,
        '@antora/atlas-extension',
        `${packageName}/latest-version-extension`,
        `${packageName}/inject-collector-cache-config-extension`,
        '@antora/collector-extension',
        `${packageName}/root-component-extension`,
        `${packageName}/static-page-extension`,
      ])
    })
  })
})
