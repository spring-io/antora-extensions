/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')

describe('extensions', () => {
  const ext = require(packageName + '/set-algolia-env-extension')

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension', () => {
      ext.register.call()
      expect(process.env.ALGOLIA_API_KEY).to.eql('9d489079e5ec46dbb238909fee5c9c29')
      expect(process.env.ALGOLIA_APP_ID).to.eql('WB1FQYI187')
      expect(process.env.ALGOLIA_INDEX_NAME).to.eql('springdocs')
    })
  })
})
