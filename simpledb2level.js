const AWS            = require('aws-sdk')
    , level          = require('level')
    , through2       = require('through2')
    , spaces         = require('level-spaces')
    , EventEmitter   = require('events').EventEmitter
    , simpledbStream = require('simpledb-stream')

function fetch (options, ee, simpledb) {

  simpledb.listDomains(function (err, data) {
    if (err)
      return ee.emit('error', err)

    if (!data || !data.DomainNames)
      return ee.emit('error', new Error('Invalid listDomains() response: ', JSON.stringify(data)))

    var domains = data.DomainNames
    if (Array.isArray(options.domains)) {
      domains = domains.filter(function (domain) {
        return options.domains.indexOf(domain) >= 0
      })
    }

    ee.emit('domains', domains)

    domains.forEach(function (domain) {
      var stream
        , config
        , streamOptions = { domain: domain }

      if (typeof options.domainConfig == 'function')
        config = options.domainConfig(domain)

      if (config && config.criteria)
        streamOptions.criteria = config.criteria

      stream = simpledbStream(simpledb, streamOptions)
      ee.emit('domain', { domain: domain, stream: stream, config: config || {} })
    })
  })

}

function processDomain (domain, config, db, stream, callback) {

  function process (chunk, enc, callback) {
    db.put(chunk.key, JSON.stringify(chunk.value), callback)
  }

  function flush (_callback) {
    _callback()
    callback && callback()
  }

  stream
    .on('error', function (err) {
      callback && callback(err)
      callback = null
    })
    .pipe(through2({ objectMode: true }, process, flush))
    .on('error', function (err) {
      callback && callback(err)
      callback = null
    })
}

function simple2level (options) {
  if (typeof options != 'object')
    throw new TypeError('Need an options object')

  if (typeof options.aws != 'object')
    throw new TypeError('Need an "aws" options property')

  if (!options.db)
    throw new TypeError('Need a "db" options property')

  AWS.config.update(options.aws)

  var ee              = new EventEmitter()
    , simpledb        = new AWS.SimpleDB()
    , db              = typeof options.db == 'string'
        ? level(options.db)
        : options.db
    , domains         = 0
    , finishedDomains = 0

  process.nextTick(function () {
    fetch(options, ee, simpledb)
  })

  ee.on('domain', function (data) {
    var domaindb = spaces(db, data.domain)

    if (typeof data.config.setupDb == 'function')
      domaindb = data.config.setupDb(domaindb)

    domains++

    function finish (err) {
      if (err)
        ee.emit('error', err)

      finishedDomains++

      if (finishedDomains === domains) {
        if (typeof options.db == 'string') {
          return db.close(function (err) {
            if (err)
              return ee.emit('error')

            ee.emit('end')
          })
        } else {
          ee.emit('end')
        }
      }
    }

    processDomain(
        data.domain
      , data.config
      , domaindb
      , data.stream
      , finish
    )
  })

  return ee
}

module.exports = simple2level
