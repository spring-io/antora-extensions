/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')

describe('set-algolia-env', () => {
  const ext = require(packageName + '/set-algolia-env-extension')

  describe('bootstrap', () => {
    it('should be able to require extension', () => {
      expect(ext).to.be.instanceOf(Object)
      expect(ext.register).to.be.instanceOf(Function)
    })

    it('should be able to call register function exported by extension', () => {
      ext.register.call()
      expect(process.env.ALGOLIA_API_KEY).to.eql('c2e84f15fa630d534f1c62b1c413bb77')
      expect(process.env.ALGOLIA_APP_ID).to.eql('WB1FQYI187')
      expect(process.env.ALGOLIA_INDEX_NAME).to.eql('springdocs')
    })
  })
})
