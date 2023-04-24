'use strict'

module.exports.register = function ({ config = {} }) {
  this.once('contentClassified', ({ contentCatalog }) => {
    const rootComponentName = config.rootComponentName
    if (!rootComponentName) {
      throw new Error('Missing required configuration attribute root_component_name for root-component-extension')
    }
    const rootComponentNameLength = rootComponentName.length
    contentCatalog.findBy({ component: rootComponentName }).forEach((file) => {
      if (file.out) {
        file.out.dirname = file.out.dirname.slice(rootComponentNameLength)
        file.out.path = file.out.path.slice(rootComponentNameLength + 1)
        file.out.rootPath = fixPath(file.out.rootPath)
      }
      if (file.pub) {
        file.pub.url = file.pub.url.slice(rootComponentNameLength + 1)
        if (file.pub.rootPath) {
          file.pub.rootPath = fixPath(file.pub.rootPath)
        }
      }
      if (file.rel) {
        if (file.rel.pub) {
          file.rel.pub.url = file.rel.pub.url.slice(rootComponentNameLength + 1) || '/'
          file.rel.pub.rootPath = fixPath(file.rel.pub.rootPath)
        }
      }
    })
    const rootComponent = contentCatalog.getComponent(rootComponentName)
    rootComponent?.versions?.forEach((version) => {
      version.url = version.url.substr(rootComponentName.length + 1)
    })
  })
}

function fixPath (path) {
  return path.split('/').slice(1).join('/') || '.'
}
