const AWS       = require('aws-sdk')
    , testData  = require('./test-data')
    , after     = require('after')
    , awsConfig = require('./aws-config.js')

AWS.config.update(awsConfig)

function populate (callback) {
  var simpledb = new AWS.SimpleDB()
    , done     = after(Object.keys(testData).length, function (err) {
        if (err)
          return callback(err)
        setTimeout(callback, 500)
      })

  Object.keys(testData).forEach(function (domain) {
    simpledb.createDomain({ DomainName: domain }, function (err) {
      if (err)
        return done(err)

      var batch = testData[domain].map(function (d) {
        var attr = Object.keys(d).map(function (a) {
          if (a == 'Name')
            return false
          return { Name: a, Value: String(d[a]) }
        }).filter(Boolean)
        return { Name: d.Name, Attributes: attr }
      })

      simpledb.batchPutAttributes({ DomainName: domain, Items: batch }, done)
    })
  })
}

module.exports = populate