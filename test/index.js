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


describe('API', function() {
  it('allows creation without using new', function (done) {
    var reporter = GoodApacheLog({file:Hoek.uniqueFilename(internals.tempDir)})
    expect(reporter._logfile).to.exist()
    done()
  })

  it('allows creation using new', function (done) {
    var reporter = new GoodApacheLog({file:Hoek.uniqueFilename(internals.tempDir)})
    expect(reporter._logfile).to.exist()
    done()
  })

  it('validates the options argument', function (done) {
    expect(function () {
      var reporter = new GoodApacheLog({ response: '*' })
    }).to.throw(Error, /missing/)
    expect(function () {
      var reporter = new GoodApacheLog({ response: '*' })
    }).to.throw(Error, /missing/)
    done()
  })

  it('properly sets up the path and file information if the file name is specified', function (done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({ file:file })

    expect(reporter._logfile.path).to.equal(file)
    internals.removeLog(reporter._logfile.path)
    done()
  })
})

describe('Behavior', function() {
  it('logs an error if one occurs on the write stream and tears down the pipeline', function (done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({file: file})
    var logError = console.error
    console.error = check_error

    reporter._logfile.emit('error', new Error('mock error'))

    function check_error(value) {
      console.error = logError
      expect(value.message).to.equal('mock error')
      internals.removeLog(reporter._logfile.path)
      done()
    }
  })

  it('writes to the current file and does not create a new one', function (done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({file:file, format:'%s'})
    expect(reporter._logfile.path).to.equal(file)

    reporter._logfile.on('finish', finished)

    for (var i = 0; i < 20; ++i)
      reporter.write({ event: 'response', statusCode: 200, id: i, tag: 'my test ' + i })
    reporter.end()

    function finished() {
      expect(reporter._logfile.bytesWritten).to.equal(80)
      internals.removeLog(reporter._logfile.path)
      done()
    }
  })

  it('can handle a large number of events', function (done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({file:file, format:'x'})
    expect(reporter._logfile.path).to.equal(file)

    reporter._logfile.on('finish', function () {
      expect(reporter._logfile.bytesWritten).to.equal(20000)
      internals.removeLog(reporter._logfile.path)
      done()
    })

    for (var i = 0; i < 10000; i++)
      reporter.write({ event: 'response', id: i, timestamp: Date.now(), value: 'value for iteration ' + i })
    reporter.end()
  })

  it('will log events even after a delay', function (done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({file:file, format:'x'})
    expect(reporter._logfile.path).to.equal(file)

    reporter._logfile.on('finish', function () {
      var bytes = 2 * (101 + 101)
      expect(reporter._logfile.bytesWritten).to.equal(bytes)
      internals.removeLog(reporter._logfile.path)
      done()
    })

    for (var i = 0; i <= 100; i++)
      reporter.write({ event: 'response', id: i, timestamp: Date.now(), value: 'value for iteration ' + i })

    setTimeout(function () {
      for (var i = 0; i <= 100; i++)
        reporter.write({ event: 'response', id: i, timestamp: Date.now(), value: 'inner iteration ' + i })
      reporter.end()
    }, 500)
  })
})

describe('SIGHUP handling', function() {
  it('re-opens the file on SIGHUP', function(done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({file:file, format:'x'})
    expect(reporter._logfile.path).to.equal(file)

    reporter._logfile.on('finish', function() {
      throw new Error('First write stream should not finish')
    })

    reporter._logfile.once('open', firstOpen)
    function firstOpen(oldFd) {
      var oldStream = reporter._logfile
      expect(oldStream.path).to.equal(file)

      // Send some requests through, then HUP, then only send one. The bytes written at finish time should be small.
      for (var i = 0; i < 5; i++)
        reporter.write({ event: 'response', id: i, timestamp: Date.now(), value: 'SIGHUP iteration ' + i })

      process.emit('SIGHUP')
      reporter._logfile.once('open', secondOpen)
      reporter.write({ event: 'response', id:1234567, timestamp: Date.now(), value: 'First event after SIGHUP'})

      function secondOpen(newFd) {
        reporter._logfile.on('finish', on_finish)
        expect(process.listeners('SIGHUP').indexOf(reporter._onSigHUP)).not.to.equal(-1)
        reporter.end()

        function on_finish() {
          expect(reporter._logfile.path).to.equal(file)
          expect(reporter._logfile).not.to.equal(oldStream)
          expect(newFd).not.to.equal(oldFd)
          expect(reporter._logfile.bytesWritten).to.equal(2)
          expect(process.listeners('SIGHUP').indexOf(reporter._onSigHUP)).to.equal(-1)
          internals.removeLog(reporter._logfile.path)
          done()
        }
      }
    }
  })

  it('does not re-open the file on SIGHUP when disabled', function(done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({file:file, format:'x', hup:false})
    expect(reporter._logfile.path).to.equal(file)
    expect(process.listeners('SIGHUP').indexOf(reporter._onSigHUP)).to.equal(-1)
    reporter._logfile.once('open', firstOpen)

    function firstOpen(oldFd) {
      var oldStream = reporter._logfile
      expect(oldStream.path).to.equal(file)

      for (var i = 0; i < 5; i++)
        reporter.write({ event: 'response', id: i, timestamp: Date.now(), value: 'SIGHUP iteration ' + i })

      process.emit('SIGHUP')
      reporter._logfile.on('finish', finished)
      reporter.write({ event: 'response', id:1234567, timestamp: Date.now(), value: 'First event after SIGHUP'})
      reporter.end()

      function finished() {
        expect(reporter._logfile.path).to.equal(file)
        expect(reporter._logfile).to.equal(oldStream)
        expect(reporter._logfile.bytesWritten).to.equal(12)

        internals.removeLog(reporter._logfile.path)
        done()
      }
    }
  })
})

describe('Formatting', function() {
  it('Supports arbitrary format strings', function(done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({file:file, format:'Sent %s to %h', separator:'\r\n'})
    expect(reporter._logfile.path).to.equal(file)

    reporter._logfile.on('finish', finished)
    reporter.write({ event: 'response', statusCode: 201, id:1, source:{remoteAddress:'1.1.1.1'} })
    reporter.write({ event: 'response', statusCode: 202, id:2, source:{remoteAddress:'2.2.2.2'} })
    reporter.write({ event: 'response', statusCode: 203, id:3, source:{remoteAddress:'3.3.3.3'} })
    reporter.end()

    function finished() {
      var logBody = Fs.readFileSync(file, 'utf8')
      expect(logBody).to.equal('Sent 201 to 1.1.1.1\r\nSent 202 to 2.2.2.2\r\nSent 203 to 3.3.3.3\r\n')
      done()
    }
  })

  it('Supports Apache httpd "nicknames"', function(done) {
    var file = Hoek.uniqueFilename(internals.tempDir)
    var reporter = new GoodApacheLog({file:file, format:'referer'})
    expect(reporter._logfile.path).to.equal(file)

    reporter._logfile.on('finish', finished)
    reporter.write({ event: 'response', statusCode: 200, id:1, path:'/1', source:{referer: undefined          } })
    reporter.write({ event: 'response', statusCode: 200, id:2, path:'/2', source:{referer:'http://localhost/2'} })
    reporter.write({ event: 'response', statusCode: 200, id:3, path:'/3', source:{referer:'http://localhost/3'} })
    reporter.end()

    function finished() {
      var logBody = Fs.readFileSync(file, 'utf8')
      expect(logBody).to.equal('- -> /1\nhttp://localhost/2 -> /2\nhttp://localhost/3 -> /3\n')
      done()
    }
  })
})
