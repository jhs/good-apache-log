module.exports = ApacheLogFile


var fs = require('fs')
var Path = require('path')
var debug = require('debug')('good:apache:log')
var Stream = require('stream')

var Hoek = require('hoek');
var Joi = require('joi');
var Squeeze = require('good-squeeze').Squeeze;

var Schema = require('./schema.js')
var LogFormat = require('./format.js')


var DEFAULTS = {format:'combined', separator:'\n', hup:true}


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

  if (self._settings.hup) {
    debug('Listen to SIGHUP')
    process.on('SIGHUP', function() {
      debug('Received SIGHUP')
      self._reopen()
    })
  }

  self._streams.write = self._buildWriteStream()
  self._streams.read = stream
  self._pipeline()

  callback()
}

ApacheLogFile.prototype._buildWriteStream = function () {
  var self = this
  debug('buildWriteStream')

  var result = fs.createWriteStream(self._settings.file, {flags:'a', end:false, encoding:'utf8'})
  result.once('error', function (er) {
    console.error(er)
    self._teardown()
  })

  return result
}

ApacheLogFile.prototype._reopen = function() {
  debug('Re-open log file')
  this._teardown()
  this._streams.write = this._buildWriteStream()
  this._pipeline()
}

ApacheLogFile.prototype._pipeline = function() {
  this._streams.read
    .pipe(this._streams.squeeze)
    .pipe(this._streams.formatter)
    .pipe(this._streams.write)
}

ApacheLogFile.prototype._teardown = function() {
  this._streams.formatter.unpipe(this._streams.write)
  this._streams.squeeze.unpipe(this._streams.formatter)
  this._streams.read.unpipe(this._streams.squeeze)
}
