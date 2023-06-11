'use strict'

const cacheScanDir = require('./cache-scandir')

const [, , ...args] = process.argv
const [scanDir, cacheDir, zipFile] = args

cacheScanDir(scanDir, cacheDir, zipFile)
