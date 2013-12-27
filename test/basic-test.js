const AWS          = require('aws-sdk')
    , test         = require('tape')
    , os           = require('os')
    , path         = require('path')
    , rimraf       = require('rimraf')
    , level        = require('level')
    , simple2level = require('../')
    , populate     = require('./populate-test-db')
    , testdb       = path.join(os.tmpDir(), process.pid + '_simple2level_test.db')
    , awsConfig    = require('./aws-config.js')
    , testData     = require('./test-data')

AWS.config.update(awsConfig)

var simpledb = new AWS.SimpleDB()

function sortTestData (data) {
  Object.keys(data).forEach(function (domain) {
    data[domain].sort(function (a1, a2) {
      return a1.Name < a2.Name ? -1 : a1.Name == a2.Name ? 0 : 1
    })
  })
}


function deleteDomains (t) {

  t.plan(Object.keys(testData).length)

  Object.keys(testData).forEach(function (domain) {
    simpledb.deleteDomain({ DomainName: domain }, function (err) {
      t.notOk(err, 'no error from deleteDomain')
    })
  })

}


function removeDb (t) {

  t.plan(1)

  rimraf(testdb, function () {
    t.ok(true, 'cleaned up')
  })

}


function reconstructActualDataFromDb (t, callback) {
  var db         = level(testdb, { valueEncoding: 'json' })
    , actualData = {}

  db.readStream()
    .on('data', function (data) {

      // take apart the sublevel structure and rebuild it into the test-data.json structure

      var ka = data.key.split('\xff')

      t.equal(ka.length, 3, 'correct key structure')

      if (!actualData[ka[1]])
        actualData[ka[1]] = []

      actualData[ka[1]].push(Object.keys(data.value).reduce(function (p, c) {
        p[c] = data.value[c]
        return p
      }, { Name: ka[2] }))

    })
    .on('end', function () {

      sortTestData(actualData)
      sortTestData(testData)

      db.close(function () {
        callback(null, actualData)
      })

    })
}


test('setup (delete domains)', deleteDomains)


test('setup (populate db)', function (t) {

  populate(function (err) {
    t.notOk(err, 'no error populating db')
    t.end()
  })

})


test('test init', function (t) {

  t.throws(simple2level, 'throws without options')
  t.throws(function () { simple2level({}) }, 'throws without aws options')
  t.throws(function () { simple2level({ aws: {} }) }, 'throws without db option')

  t.end()

})


test('test sync', function (t) {
  var s2l = simple2level({ aws: awsConfig, db: testdb })

  t.ok(true, 'init without error')

  s2l.on('domains', function (domains) {
    t.deepEqual(domains, Object.keys(testData), 'got correct domains')
  })

  s2l.on('error', t.fail.bind(t))

  s2l.on('end', function () {

    reconstructActualDataFromDb(t, function (err, actualData) {

      t.deepEqual(actualData, testData, 'data in db matches test data!')
      t.end()

    })

  })

})


test('teardown sync', removeDb)


test('test domainConfig `setupDb` option', function (t) {

  // we should be able to adjust the db to collect the data as it's being
  // written and then compare it to the expected data; mainly to prove that
  // we can mess with the db with `setupDb`

  var actualData = {}

  function setupDb (db) {
    var self = this
    db.___put = db.put
    db.put = function (key, value) {
      var o = { Name: key }
      Object.keys(value).forEach(function (prop) {
        o[prop] = value[prop]
      })
      self.push(o)
      return db.___put.apply(db, arguments)
    }
    return db
  }

  function domainConfig (domain) {
    return { setupDb: setupDb.bind(actualData[domain] = []) }
  }

  var s2l = simple2level({ aws: awsConfig, db: testdb, domainConfig: domainConfig })

  t.ok(true, 'init without error')

  s2l.on('error', t.fail.bind(t))

  s2l.on('end', function () {

    sortTestData(actualData)
    sortTestData(testData)

    t.deepEqual(actualData, testData, 'data put db matches test data!')

    t.end()
  })

})


test('teardown domainConfig `setupDb` option', removeDb)


test('test single domain with `criteria` option', function (t) {

  function domainConfig (domain) {
    t.equal(domain, 'simple2level-domain1', 'got expected domain')
    return { criteria: 'date <= "2013-12-22"' }
  }

  var s2l = simple2level({
      aws          : awsConfig
    , db           : testdb
    , domains      : [ 'simple2level-domain1' ]
    , domainConfig : domainConfig
  })

  s2l.on('error', t.fail.bind(t))

  s2l.on('end', function () {

    reconstructActualDataFromDb(t, function (err, actualData) {

      var truncTestData = testData['simple2level-domain1']

      truncTestData.sort(function (a1, a2) {
        return a1.date < a2.date ? -1 : a1.date == a2.date ? 0 : 1
      })

      truncTestData = truncTestData.slice(0, 2)

      sortTestData(actualData)
      sortTestData({ 'blurg': truncTestData })

      t.deepEqual(
          actualData['simple2level-domain1']
        , truncTestData
        , 'data in db matches truncated test data!'
      )
      t.end()

    })

  })

})


test('teardown single domain with `criteria` option', removeDb)


test('teardown (delete domains)', deleteDomains)
