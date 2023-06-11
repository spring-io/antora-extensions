'use strict'

const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

const copyRecursiveSync = function (src, dest) {
  const exists = fs.existsSync(src)
  const stats = exists && fs.statSync(src)
  const isDirectory = exists && stats.isDirectory()
  if (isDirectory) {
    fs.mkdirSync(dest)
    fs.readdirSync(src).forEach(function (childItemName) {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName))
    })
  } else {
    fs.copyFileSync(src, dest)
  }
}

const zip = function (src, destination) {
  const output = fs.createWriteStream(destination)
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Sets the compression level.
  })
  // listen for all archive data to be written
  // 'close' event is fired only when a file descriptor is involved
  output.on('close', function () {
    console.log(archive.pointer() + ' total bytes')
    console.log('archiver has been finalized and the output file descriptor has closed.')
  })

  // This event is fired when the data source is drained no matter what was the data source.
  // It is not part of this library but rather from the NodeJS Stream API.
  // @see: https://nodejs.org/api/stream.html#stream_event_end
  output.on('end', function () {
    console.log('Data has been drained')
  })

  // good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on('warning', function (err) {
    if (err.code === 'ENOENT') {
      // log warning
    } else {
      // throw error
      throw err
    }
  })

  // good practice to catch this error explicitly
  archive.on('error', function (err) {
    throw err
  })

  // pipe archive data to the file
  archive.pipe(output)

  archive.directory(src, false)

  archive.finalize()
}

function cacheScanDir (scanDir, cacheDir, zipFile) {
  copyRecursiveSync(scanDir, cacheDir)
  zip(cacheDir, zipFile)
}

module.exports = cacheScanDir
