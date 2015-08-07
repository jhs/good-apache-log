module.exports = main

var Hapi = require('hapi')
var Good = require('good')

var GoodApacheLog = require('../index.js')


function main() {
  var server = new Hapi.Server()
  server.connection({host:'0.0.0.0', port:8080})
  server.route({method:'*', path:'/{path*}', handler:handler})

  var reporter = {reporter:GoodApacheLog, events:{response:'*',tail:'*'}, config:__dirname+'/test.log'}
  server.register([{register:Good, options:{responsePayload:true, reporters:[reporter]}}], registered)

  function registered(er) {
    if (er) throw er

    server.start(function() {
      console.log('Ready; pid: %s', process.pid)
    })
  }
}

function handler(req, reply) {
  var code = +(req.query.code || 200)
  var info = JSON.parse(JSON.stringify(req.info))
  var link = (Math.random() + '').replace(/^0\./, '')

  reply('Hello<p><a href="/'+link+'">Page '+link+'</a>')
    .code(code)
}


if (require.main === module)
  main()
