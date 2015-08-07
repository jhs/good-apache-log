module.exports = main

var fs = require('fs')
var Hapi = require('hapi')
var Good = require('good')

var GoodApacheLog = require('../index.js')


function main() {
  var server = new Hapi.Server()
  server.connection({host:'0.0.0.0', port:8080})
  server.route({method:'*', path:'/{path*}', handler:handler})

  var events = {response:'*', ops:'*', log:'*', error:'*', request:'*', wreck:'*'}
  var reporter = {reporter:GoodApacheLog, events:events, config:__dirname+'/test.log'}
  server.register([{register:Good, options:{responsePayload:true, reporters:[reporter]}}], registered)

  function registered(er) {
    if (er) throw er

    server.start(function() {
      fs.writeFileSync(__dirname + '/.pid', process.pid+'\n')
      console.log('Ready; pid: %s', process.pid)
    })
  }
}

function handler(req, reply) {
  var code = +(req.query.code || 200)
  var info = JSON.parse(JSON.stringify(req.info))
  var link = (Math.random() + '').replace(/^0\.\d{11}/, '')

  reply('Hello<p><a href="/'+link+'">Page '+link+'</a>')
    .code(code)
}


if (require.main === module)
  main()
