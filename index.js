module.exports = GoodApacheLog


var fs = require('fs')
var util = require('util')
var Path = require('path')
var debug = require('debug')('good:apache:log')
var Stream = require('stream')

var Hoek = require('hoek');
var Joi = require('joi');
var Squeeze = require('good-squeeze').Squeeze;

var LogFormat = require('./format.js')

var DEFAULTS = {format:'combined', separator:'\n', hup:true}
var SinkSchema = [Joi.string().required(), Joi.object().type(Stream.Stream).required()];
var OptionsSchema = Joi.alternatives().try(
  SinkSchema,
  Joi.object().keys({
    file  : SinkSchema,
    format: Joi.string(),
    separator: Joi.string(),
    hup: Joi.boolean()
  })
)


util.inherits(GoodApacheLog, Stream.Transform)
function GoodApacheLog (config) {
  if (!(this instanceof GoodApacheLog))
    return new GoodApacheLog(config)

  var self = this
  Stream.Transform.call(self, {objectMode: true})

  config = config || false
  debug('Init %j', config)
  Joi.assert(config, OptionsSchema, 'Invalid options');

  if (typeof config == 'string' || config instanceof Stream.Stream)
    config = { file: config }

  self._settings = Hoek.applyToDefaultsWithShallow(DEFAULTS, config, ['file'])
  debug('Settings: %j', self._settings)

  self._formatter = LogFormat(null, this._settings)
  self._logfile = self._buildWriteStream()

  self.pipe(self._formatter)
  self._formatter.pipe(self._logfile)

  if (!self._settings.hup)
    debug('No listen to SIGHUP')
  else {
    debug('Listen to SIGHUP')
    process.on('SIGHUP', onSigHUP)
    self.on('end', function() {
      debug('Events stopped; remove onSigHUP listener')
      process.removeListener('SIGHUP', onSigHUP)
    })
  }

  // Export onSigHUP for the test suite to use.
  self._onSigHUP = onSigHUP

  function onSigHUP() {
    debug('Received SIGHUP')
    self._reopen()
  }
}

GoodApacheLog.prototype._reopen = function() {
  debug('Re-open log file')
  this._teardown()
  this._logfile = this._buildWriteStream()
  this._formatter.pipe(this._logfile)
}

GoodApacheLog.prototype._buildWriteStream = function () {
  var self = this

  if (self._settings.file instanceof Stream.Stream)
    return self._settings.file

  var result = fs.createWriteStream(self._settings.file, {flags:'a', end:false, encoding:'utf8'})
  result.once('error', function (er) {
    console.error(er)
    self._teardown()
  })

  return result
}

GoodApacheLog.prototype._teardown = function() {
  this._formatter.unpipe(this._logfile)
}

GoodApacheLog.prototype._transform = function(data, enc, callback) {
  // Only process "response" events.
  if (data.event != 'response') {
    debug('Bad event for good-apache-log: %j', data.event)
    return next()
  }

  this.push(data)
  callback()
}
