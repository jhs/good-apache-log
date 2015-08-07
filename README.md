# Good-Apache-Log

Apache httpd log files for Hapi web servers

Lead Maintainer: [Jason Smith][jhs]

## Overview

Good-Apache-Log makes [Hapi][hapi] write server logs in the server logs in the Apache [combined][combined-format] or [common][common-format] log format, via the [Good][good] reporting framework.

The Apache format? You know: this one&mdash;the ubiquitous format every tool on the Internet can process.

    127.0.0.1 - - [07/Aug/2015:14:01:21 +07:00] "GET / HTTP/1.1" 200 39 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/600.7.12 (KHTML, like Gecko) Version/8.0.7 Safari/600.7.12"
    127.0.0.1 - - [07/Aug/2015:14:01:21 +07:00] "GET /favicon.ico HTTP/1.1" 200 39 "http://localhost:8080/" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/600.7.12 (KHTML, like Gecko) Version/8.0.7 Safari/600.7.12"
    127.0.0.1 - - [07/Aug/2015:14:01:31 +07:00] "GET /product/280 HTTP/1.1" 200 45 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.130 Safari/537.36"
    127.0.0.1 - - [07/Aug/2015:14:01:31 +07:00] "GET /favicon.ico HTTP/1.1" 200 41 "http://localhost:8080/product/280" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.130 Safari/537.36"

Good-Apache-Log appends to a log file, and it it re-opens the log file when you send `SIGHUP`. This makes it very easy to implement log rotation, using [logrotate][logrotate], for example.

In other words, Good-Apache-Log makes your Hapi server a much more friendly dev-ops citizen by supporting standard logging formats and behavior.

## Usage

Place Good-Apache-Log as a reporter in your [Good][good] configuration.

``` js
var logFile = "my-server.log"
var reporters = [ {reporter:GoodApacheLog, events:{response:'*'}, config:logFile} ]
var goodPlugin = {register:Good, options:{responsePayload:true, reporters:reporters}}
server.register([goodPlugin], function(er) {
  if (!er)
    console.log('GoodApacheLog is registered.')
})
```

Now you will see a familiar face in `my-server.log`.

Note, if you set `"responsePayload": true` in the Good config, then your logs will show the response payload size (the `%b` format string). Otherwise, the payload size will be logged as `-`.

See [test/server.js][server.js] for an example of a very simple Hapi server that uses `GoodApacheLog`.

## Configuration

Usually, you can set the reporter `config` value to the path to your log file. Hapi will now automatically append logs to that file, and if you send a `HUP` signal to your server, it will re-open that file.

However, for more detailed control, `config` can be an object with these keys:

* **file** - The path to the log file
* **format** - The log format to use, default is `"combined"`; see [Log Formats](#log-formats) below
* **separator** - The separator between log lines, default is `"\n"`
* **hup** - Boolean; if `true`, Good-Apache-Log will listen to `SIGHUP` and re-open its log file; default is `true`

## Log Formats

Similar to the Apache httpd server, the `format` value allows you to specify your log file format. Either choose a "nickname" or provide your own [format string][formats].

**Note** Not all format strings are supported yet. If you need one, please create an issue or pull request.

For example to make a simple log file of status codes and user-agents:

``` js
var reporters = [
  {
    reporter: GoodApacheLog,
    events: {response:'*'},
    config: {file:"httpd.log", format:"%s %{User-agent}i"}
  }
]
```

Example log file:

    200 Mozilla/5.0 (Macintosh; Intel Mac OS X 10.10; rv:39.0) Gecko/20100101 Firefox/39.0
    404 Mozilla/5.0 (iPhone; CPU iPhone OS 8_4 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12H143 Safari/600.1.4
    500 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.130 Safari/537.36
    200 Mozilla/5.0 (iPhone; CPU iPhone OS 8_4 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Version/8.0 Mobile/12H143 Safari/600.1.4
    301 Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.130 Safari/537.36

### Supported nicknames

These nicknames, taken from from the Apache httpd documentation, expand to the most commonly-used log formats.

* combined: `%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-agent}i"`
* common: `%h %l %u %t "%r" %>s %b`
* referer: `%{Referer}i -> %U`

[jhs]: https://github.com/jhs
[good]: https://github.com/hapijs/good
[hapi]: http://hapijs.com/
[combined-format]: http://httpd.apache.org/docs/1.3/logs.html#combined
[common-format]: http://httpd.apache.org/docs/1.3/logs.html#common
[logrotate]: http://www.linuxcommand.org/man_pages/logrotate8.html
[server.js]: ./test/server.js
[formats]: http://httpd.apache.org/docs/2.2/mod/mod_log_config.html#formats
