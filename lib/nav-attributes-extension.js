'use strict'

const { name: packageName } = require('../package.json')

const BANNED_NAMES = ['content', 'url', 'urlType', 'items', 'root', 'order']

function register () {
  const logger = this.getLogger(packageName)

  const byVersionedComponent = new Map()

  this.once('contentAggregated', ({ contentAggregate }) => {
    for (const componentVersionBucket of contentAggregate) {
      const versionedComponent = componentVersionBucket.version + '@' + componentVersionBucket.name
      for (const origin of componentVersionBucket.origins) {
        const navAttributes = origin.descriptor?.ext?.navAttributes
        if (navAttributes) {
          const byPath = (
            byVersionedComponent.has(versionedComponent)
              ? byVersionedComponent
              : byVersionedComponent.set(versionedComponent, new Map())
          ).get(versionedComponent)
          for (const { path, attributes } of navAttributes) {
            const matchingBannedNames = Object.keys(attributes).filter((name) => BANNED_NAMES.includes(name))
            if (matchingBannedNames.length > 0) {
              throw new Error(
                `Navigation attributes ${JSON.stringify(
                  attributes
                )} for path '${path}' on '${versionedComponent}' contains banned names '${matchingBannedNames}'`
              )
            }
            logger.trace(
              `Stored navigation attributes ${JSON.stringify(attributes)} for path '${path}' on ${versionedComponent}`
            )
            byPath.set(path, !byPath.has(path) ? attributes : { ...byPath.get(path), ...attributes })
          }
        }
      }
    }
  })

  this.once('navigationBuilt', ({ contentCatalog }) => {
    contentCatalog.getComponents().forEach(({ versions }) => {
      versions.forEach(({ name: component, version, navigation }) => {
        const versionedComponent = version + '@' + component
        const byPath = byVersionedComponent.get(versionedComponent)
        if (byPath) {
          for (const [path, attributes] of byPath) {
            applyAttributes(versionedComponent, navigation, !Array.isArray(path) ? [path] : path, attributes)
          }
        }
      })
    })

    function applyAttributes (versionedComponent, navigation, path, attributes) {
      const item = findItem(navigation, path)
      if (!item) {
        throw new Error(`Unable to find navigation item for path ${path}`)
      }
      const names = Object.keys(attributes)
      const matchingExistingNames = Object.keys(item).filter((name) => names.includes(name))
      if (matchingExistingNames.length > 0) {
        throw new Error(
          `Navigation attributes ${JSON.stringify(
            attributes
          )} for path '${path}' on '${versionedComponent}' not applied due to existing name(s) '${matchingExistingNames}'`
        )
      }
      Object.assign(item, attributes)
      logger.trace(
        `Applied navigation attributes ${JSON.stringify(attributes)} for path '${path}' on ${versionedComponent}`
      )
    }

    function findItem (items, path) {
      for (const item of !items ? [] : items) {
        if (item.content === path[0]) {
          return path.length !== 1 ? findItem(item.items, path.slice(1)) : item
        }
        if (!item.content) {
          const result = findItem(item.items, path)
          if (result) return result
        }
      }
      return null
    }
  })
}

module.exports = { register }
