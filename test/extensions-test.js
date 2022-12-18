/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')

describe('extensions', () => {
  const ext = require(packageName)

  const createGeneratorContext = () => ({
    once (eventName, fn) {
      this[eventName] = fn
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
      expect(Object.keys(generatorContext)).to.eql(['once'])
    })
  })
})
