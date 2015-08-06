module.exports = ApacheHttpdFormatter

var Hoek = require('hoek')
var debug = require('debug')('good:apache:format')
var Stream = require('stream')
var moment = require('moment')
var querystring = require('querystring')

var Pkg = require('./package.json')

var FORMAT_RE = /%(\{.*?\}|>)?[%a-zA-Z]/g
var MOMENT_FORMAT = '[[]DD/MMM/YYYY:HH:mm:ss Z[]]'

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

  var timestamp = moment(data.timestamp)
  var replacements =
    { '%%': '%'
    , '%h': data.source.remoteAddress
    , '%l': '-'
    , '%u': '-'
    , '%t': timestamp.format(MOMENT_FORMAT)
    , '%r': mkRequestLine(data)
    , '%s': data.statusCode
    , '%>s': data.statusCode
    , '%b': responseBytes(data)
    , '%{Referer}i': data.source.referer || '-'
    , '%{User-agent}i': data.source.userAgent || '-'
    }

  var line = this.format.replace(FORMAT_RE, replacer)
  this.push(line + this.separator)
  next(null)

  function replacer(match, param) {
    var val = replacements[match]

    if (!val) {
      console.error('WARNING: Not implemented; please submit an issue or PR at %s for format: %j', Pkg.bugs.url, match)
      val = '-'
    }

    debug('Replace %s (%s): %s', match, val)
    return val
  }
}

//
// Utilities
//

// Return the response payload size in bytes.
// TODO: The payload size is only known if the user sets responsePayload:true in the Good options.
// TODO: If the payload is an object (something for Hapi to JSON.stringify), then this will stringify it again to determine the length.
function responseBytes(data) {
  var payload = data.responsePayload
  if (!payload)
    return '-'

  if (typeof payload == 'string' || Buffer.isBuffer(payload))
    return payload.length

  return JSON.stringify(payload).length
}

// Return the first line of the request.
// TODO: This line is faked, generated from data about the request. Worse, the HTTP version is hard-coded.
function mkRequestLine(data) {
  var method = data.method
  var version = 'HTTP/1.1'

  var firstLog = data.log && data.log[0]
  if (firstLog && ~firstLog.tags.indexOf('received')) {
    debug('Pull the request line from the first "received" log')
    var url = firstLog.data.url
  } else {
    debug('Ascertain request line manually from the path and query')
    var url = data.path + '?' + querystring.stringify(data.query)
  }

  return method.toUpperCase() + ' ' + url + ' ' + version
}
