module.exports = ApacheLogFile


var fs = require('fs')
var Path = require('path')
var debug = require('debug')('good:apache:log')
var Stream = require('stream')

var Hoek = require('hoek');
var Joi = require('joi');
var Moment = require('moment');
var Squeeze = require('good-squeeze').Squeeze;

var Schema = require('./schema.js')
var LogFormat = require('./format.js')


var DEFAULTS = {format:'combined', separator:'\n', hup:false}


function ApacheLogFile (events, config) {
  if (!(this instanceof ApacheLogFile))
    return new ApacheLogFile(events, config)

  debug('Initialize log', {events:events, config:config})

  config = config || false
  Joi.assert(config, Schema.options);

  if (typeof config == 'string')
    config = { file: config }

  this._settings = Hoek.applyToDefaults(DEFAULTS, config)
  debug('Settings: %j', this._settings)

  this._streams = {
    squeeze: Squeeze(events),
    formatter: LogFormat(null, this._settings)
  }
}

ApacheLogFile.prototype.init = function (stream, emitter, callback) {
  var self = this
  debug('Init')

  //emitter.on('stop', function () {
  //  debug('Stop')
  //})

  if (self._settings.hup) {
    debug('Listen to SIGHUP')
    process.on('SIGHUP', function() {
      debug('Received SIGHUP')
      self.teardown()
      self.openLog()
    })
  }

  this._streams.write = this._buildWriteStream()
  this._streams.read = stream

  pipeLine(this._streams)

  callback()
}

ApacheLogFile.prototype._buildWriteStream = function () {
  var self = this
  debug('buildWriteStream')

  var result = fs.createWriteStream(self._settings.file, {flags:'a', end:false, encoding:'utf8'})
  result.once('error', function (er) {
    console.error(er)
    tearDown(self._streams)
  })

  return result
}


//internals.setUpRotate = function (reporter, period) {
//
//    var now = Moment.utc();
//
//    var timeout;
//
//    period = period.toLowerCase();
//    now.endOf(internals.timeMap[period]);
//    timeout = now.valueOf() - Date.now();
//
//    reporter._state.timeout = Bt.setTimeout(function () {
//
//        internals.rotate(reporter, period);
//    }, timeout);
//
//};
//
//
//internals.rotate = function (reporter, period) {
//
//    internals.tearDown(reporter._streams);
//    reporter._streams.write = reporter._buildWriteStream();
//    internals.pipeLine(reporter._streams);
//    internals.setUpRotate(reporter, period);
//};
//
//

//
// Utilities
//

function pipeLine (streams) {
  streams.read
    .pipe(streams.squeeze)
    .pipe(streams.formatter)
    .pipe(streams.write)
}

function tearDown(streams) {
  streams.formatter.unpipe(streams.write)
  streams.squeeze.unpipe(streams.formatter)
  streams.read.unpipe(streams.squeeze)
}
