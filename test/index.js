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

  it('properly sets up the path and file information if the file name is specified', function (done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({ log: '*' }, file)
    var ee = new EventEmitter()
    var stream = internals.readStream()

    reporter.init(stream, ee, function (error) {
      expect(error).to.not.exist()
      expect(reporter._streams.write.path).to.equal(file)
      internals.removeLog(reporter._streams.write.path)
      done()
    })
  })
})

describe('Behavior', function() {
  it('logs an error if one occurs on the write stream and tears down the pipeline', function (done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({ request: '*' }, file)
    var ee = new EventEmitter()
    var logError = console.error
    var read = internals.readStream()

    console.error = check_error

    reporter.init(read, ee, function (error) {
      expect(error).to.not.exist()
      reporter._streams.write.emit('error', new Error('mock error'))
    })

    function check_error(value) {
      console.error = logError
      expect(value.message).to.equal('mock error')
      internals.removeLog(reporter._streams.write.path)
      done()
    }
  })

  it('writes to the current file and does not create a new one', function (done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({ request: '*' }, {file:file, format:'%s'})
    var ee = new EventEmitter()
    var read = internals.readStream()

    reporter.init(read, ee, function (error) {
      expect(error).to.not.exist()
      expect(reporter._streams.write.path).to.equal(file)

      reporter._streams.write.on('finish', finished)

      for (var i = 0; i < 20; ++i)
        read.push({ event: 'request', statusCode: 200, id: i, tag: 'my test ' + i })
      read.push(null)

      function finished() {
        expect(error).to.not.exist()
        expect(reporter._streams.write.bytesWritten).to.equal(80)

        internals.removeLog(reporter._streams.write.path)
        done()
      }
    })
  })

  it('can handle a large number of events', function (done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({ request: '*' }, {file:file, format:'x'})
    var ee = new EventEmitter()
    var read = internals.readStream()

    reporter.init(read, ee, function (error) {
      expect(error).to.not.exist()
      expect(reporter._streams.write.path).to.equal(file)

      reporter._streams.write.on('finish', function () {
        expect(reporter._streams.write.bytesWritten).to.equal(20000)
        internals.removeLog(reporter._streams.write.path)
        done()
      })

      for (var i = 0; i < 10000; i++)
        read.push({ event: 'request', id: i, timestamp: Date.now(), value: 'value for iteration ' + i })
      read.push(null)
    })
  })

  it('will log events even after a delay', function (done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({ request: '*' }, {file:file, format:'x'})
    var ee = new EventEmitter()
    var read = internals.readStream()

    reporter.init(read, ee, function (error) {
      expect(error).to.not.exist()
      expect(reporter._streams.write.path).to.equal(file)

      reporter._streams.write.on('finish', function () {
        var bytes = 2 * (101 + 101)
        expect(reporter._streams.write.bytesWritten).to.equal(bytes)
        internals.removeLog(reporter._streams.write.path)
        done()
      })

      for (var i = 0; i <= 100; i++)
        read.push({ event: 'request', id: i, timestamp: Date.now(), value: 'value for iteration ' + i })

      setTimeout(function () {
        for (var i = 0; i <= 100; i++)
          read.push({ event: 'request', id: i, timestamp: Date.now(), value: 'inner iteration ' + i })
        read.push(null)
      }, 500)
    })
  })
})
