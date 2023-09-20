'use strict'

const fsp = require('node:fs/promises')
const resolvedSearch = require.resolve('@springio/antora-extensions/static-pages/search')

module.exports.register = function () {
  this.once('contentAggregated', async ({ contentAggregate }) => {
    for (const componentVersionBucket of contentAggregate) {
      const searchFile = {
        path: 'modules/ROOT/pages/search.adoc',
        contents: Buffer.from(await fsp.readFile(resolvedSearch, 'utf8')),
        src: {
          path: 'modules/ROOT/pages/search.adoc',
          basename: 'search.adoc',
          stem: 'search',
          extname: '.adoc',
          abspath: resolvedSearch,
        },
      }
      componentVersionBucket.files.push(searchFile)
    }
  })
}
