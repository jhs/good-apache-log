var EventEmitter = require('events').EventEmitter
var Fs = require('fs')
var Os = require('os')
var Path = require('path')
var Stream = require('stream')

var Code = require('code')
var Lab = require('lab')
var lab = exports.lab = Lab.script()
var Hoek = require('hoek')

// Lab shortcuts
var describe = lab.describe
var it = lab.it
var expect = Code.expect

var GoodApacheLog = require('..')


// Declare internals
var internals = {
    tempDir: Os.tmpDir()
}

internals.removeLog = function (path) {
  if (Fs.existsSync(path)) {
    Fs.unlinkSync(path)
  }
}

internals.getLog = function (path, callback) {
  Fs.readFile(path, { encoding: 'utf8' }, function (error, data) {
    if (error) {
      return callback(error)
    }

    var results = JSON.parse('[' + data.replace(/\n/g, ',').slice(0, -1) + ']')
    callback(null, results)
  })
}


internals.readStream = function (done) {
  var result = new Stream.Readable({ objectMode: true })
  result._read = Hoek.ignore

  if (typeof done === 'function') {
    result.once('end', done)
  }

  return result
}


describe('API', function() {
  it('allows creation without using new', function (done) {
    var reporter = GoodApacheLog({ log: '*' }, Hoek.uniqueFilename(internals.tempDir))
    expect(reporter._streams).to.exist()
    done()
  })

  it('allows creation using new', function (done) {
    var reporter = new GoodApacheLog({ log: '*' }, Hoek.uniqueFilename(internals.tempDir))
    expect(reporter._streams).to.exist()
    done()
  })

  it('validates the options argument', function (done) {
    expect(function () {
      var reporter = new GoodApacheLog({ log: '*' })
    }).to.throw(Error, /"value" must be a string/)
    expect(function () {
      var reporter = new GoodApacheLog({ log: '*' })
    }).to.throw(Error, /"value" must be an object/)
    done()
  })
})

