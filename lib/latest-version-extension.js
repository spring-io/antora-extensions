'use strict'

const TagSemVerRx = /^v?(\d+)\.(\d+)\.(\d+)(?:-(RC|M)(\d+))?$/

/**
 * Removes components with tags that are not the latest patch of a generation.
 */
module.exports.register = function () {
  const logger = this.getLogger('latest-version-extension')
  this.once('contentAggregated', ({ contentAggregate }) => {
    const componentToGenerationMapping = new Map()
    const tags = contentAggregate
      .slice()
      .filter((a) => a.origins[0].tag)
      .sort((a, b) => compareSemVerAscending(componentRefname(a), componentRefname(b)))
      .reverse()

    for (const componentVersionBucket of tags) {
      const { name: componentName } = componentVersionBucket
      if (!componentToGenerationMapping.has(componentName)) {
        componentToGenerationMapping.set(componentName, new Map())
      }
      const generationToComponenVersionBucket = componentToGenerationMapping.get(componentName)
      const refname = componentRefname(componentVersionBucket)
      const generation = extractGeneration(refname)
      if (generationToComponenVersionBucket.has(generation)) {
        // the size of contentAggregate changes, so we must look up the index every time
        const indexToRemove = contentAggregate.findIndex((c) => c === componentVersionBucket)
        contentAggregate.splice(indexToRemove, 1)
        continue
      }

      generationToComponenVersionBucket.set(generation, componentVersionBucket)
    }
    logger.info(`Using refnames ${contentAggregate.map((c) => c.name + ' ' + componentRefname(c))}`)
  })

  this.once('componentsRegistered', ({ contentCatalog }) => {
    const components = contentCatalog.getComponents()
    for (const component of components) {
      for (const componentVersion of component.versions) {
        const { version, prerelease } = componentVersion
        const generation = extractGeneration(version)
        const versionSegment = prerelease === '-SNAPSHOT' ? generation + prerelease : generation
        componentVersion.versionSegment = versionSegment
      }
    }
  })
}

function extractGeneration (version) {
  const parts = extractVersionParts(version).slice(0, 2)
  return parts.join('.')
}

function componentRefname (c) {
  // FIXME: Can there be more than a single origin?
  return c.origins[0].refname
}

function compareSemVerAscending (lhs, rhs) {
  const lhsParts = extractVersionParts(lhs)
  const rhsParts = extractVersionParts(rhs)
  for (const [index, leftPart] of lhsParts.entries()) {
    const rightPart = rhsParts[index]
    if (leftPart !== rightPart) {
      if (index !== 3) {
        return Number(leftPart) - Number(rightPart)
      }
      return leftPart < rightPart ? -1 : 1
    }
  }
  return 0
}

function extractVersionParts (version) {
  const match = version.match(TagSemVerRx)
  if (!match) {
    throw new Error(`Cannot parse version = ${version} with regex ${TagSemVerRx}`)
  }
  const result = Array.from(match)
  result.splice(0, 1)
  const milestoneRcIndex = result.length - 2
  if (result[milestoneRcIndex] === undefined) {
    result[milestoneRcIndex] = 'Z'
  }
  return result
}
