module.exports = ApacheHttpdFormatter

var Hoek = require('hoek')
var debug = require('debug')('good:apache:format')
var Stream = require('stream')


var FORMAT_RE = /%(\{.*?\}|>)?[%a-zA-Z]/g
var DEFAULT = {format:'combined', separator:'\n'}
var FORMATS = { 'combined': '%h %l %u %t \"%r\" %>s %b \"%{Referer}i\" \"%{User-agent}i\"'
              }


Hoek.inherits(ApacheHttpdFormatter, Stream.Transform)
function ApacheHttpdFormatter (options, transformOptions) {
  if (!(this instanceof ApacheHttpdFormatter))
    return new ApacheHttpdFormatter(options, transformOptions)

  debug('Initialize formatter')
  options = options || {}
  options.objectMode = true
  Stream.Transform.call(this, options)

  transformOptions = transformOptions || {}
  var config = Hoek.applyToDefaults(DEFAULT, transformOptions)
  this.separator = config.separator
  this.format = FORMATS[config.format] || config.format
  debug('Formatter config', {separator:this.separator, format:this.format})
}


ApacheHttpdFormatter.prototype._transform = function (data, _encoding, next) {
  debug('ApacheHttpdFormatter transform', data)

  var replacements = {
    '%h': data.source.remoteAddress
  }

  var line = this.format.replace(FORMAT_RE, replacer)
  this.push(line + this.separator)
  next(null)

  function replacer(match, param) {
    var val = replacements[match] || '-'
    debug('Replace %s: %s', match, val)
    return val
  }
}
