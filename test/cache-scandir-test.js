/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')
const fs = require('fs')
const os = require('os')
const ospath = require('node:path')
const decompress = require('decompress')

const FIXTURES_DIR = ospath.join(__dirname, 'fixtures')
describe('cache-scandir-command', () => {
  const tempDir = function (prefix) {
    return fs.mkdtempSync(ospath.join(os.tmpdir(), prefix))
  }

  let originalArgv
  let workSpaceDir
  beforeEach(() => {
    originalArgv = process.argv
    workSpaceDir = tempDir('cache-scandir-workSpace-')
  })

  afterEach(() => {
    process.argv = originalArgv
  })

  describe('cacheScanDir', () => {
    it('caches the result', () => {
      const scanDir = ospath.join(FIXTURES_DIR, 'generated-antora-resources')
      const cacheDir = ospath.join(workSpaceDir, 'cache')
      const zipFile = ospath.join(workSpaceDir, 'zip.zip')
      const zipOutputDir = ospath.join(workSpaceDir, 'zip-output')
      process.argv = ['', '', scanDir, cacheDir, zipFile]
      require(packageName + '/cache-scandir')
      expect(fs.existsSync(zipFile)).to.eql(true)
      expect(fs.existsSync(ospath.join(cacheDir, 'antora.yml'))).to.eql(true)
      expect(fs.existsSync(ospath.join(cacheDir, 'modules/ROOT/pages/generated.adoc'))).to.eql(true)
      decompress(zipFile, zipOutputDir)
      expect(fs.existsSync(ospath.join(zipOutputDir, 'antora.yml'))).to.eql(true)
      expect(fs.existsSync(ospath.join(zipOutputDir, 'modules/ROOT/pages/generated.adoc'))).to.eql(true)
    })
  })
})
