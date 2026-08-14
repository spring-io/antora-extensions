'use strict'

const buildNavigation = require('./build-navigation')

module.exports.register = function () {
  const logger = this.getLogger('override-navigation-builder-extension')
  logger.warn(
    'override-navigation-builder-extension is deprecated and no longer registered by default. ' +
      'Antora 3.2.0-alpha.9 and later already propagate roles onto navigation entries natively ' +
      '(see antora/antora#701); upgrade Antora and remove this extension from your playbook.'
  )
  this.replaceFunctions({
    buildNavigation (contentCatalog, siteAsciiDocConfig) {
      return buildNavigation.call(this, contentCatalog, siteAsciiDocConfig)
    },
  })
}
