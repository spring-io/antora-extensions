/* eslint-env mocha */
'use strict'

const { expect } = require('./harness')
const { name: packageName } = require('#package')
const fs = require('fs')
const os = require('os')
const ospath = require('node:path')
const copyRecursive = require(packageName + '/cache-scandir/copy-recursive')

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
      process.argv = ['', '', scanDir, cacheDir]
      require(packageName + '/cache-scandir')
      expect(fs.existsSync(ospath.join(cacheDir, 'antora.yml'))).to.eql(true)
      expect(fs.existsSync(ospath.join(cacheDir, 'modules/ROOT/pages/generated.adoc'))).to.eql(true)
    })
  })
  it('works when multiple scan_dir and contains existing dir', () => {
    const scanDir = ospath.join(FIXTURES_DIR, 'generated-antora-resources')
    const cacheDir = ospath.join(workSpaceDir, 'cache')
    copyRecursive(scanDir, cacheDir)
    const scanDir2 = ospath.join(FIXTURES_DIR, 'generated-antora-resources-2')
    copyRecursive(scanDir2, cacheDir)
    expect(fs.existsSync(ospath.join(cacheDir, 'antora.yml'))).to.eql(true)
    expect(fs.existsSync(ospath.join(cacheDir, 'modules/ROOT/pages/generated.adoc'))).to.eql(true)
    expect(fs.existsSync(ospath.join(cacheDir, 'modules/ROOT/pages/generated2.adoc'))).to.eql(true)
  })
})
