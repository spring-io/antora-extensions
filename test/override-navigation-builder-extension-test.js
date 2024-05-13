/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')
describe('override-navigation-builder-extension', () => {
  const ext = require(packageName + '/override-navigation-builder-extension')
  const createGeneratorContext = () => ({
    fns: [],
    replaceFunctions (functions) {
      this.fns = functions
    },
  })

  let generatorContext

  beforeEach(async () => {
    generatorContext = createGeneratorContext()
  })

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('replaces buildNavigation', () => {
      ext.register.call(generatorContext)
      expect(generatorContext.fns.buildNavigation).to.be.instanceOf(Function)
    })
  })
})
