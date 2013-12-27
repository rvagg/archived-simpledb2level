# simpledb2level

**Stream SimpleDB data into a local LevelDB store**

Fetch data out of SimpleDB so you can work with it locally and with all the benefits of the level* ecosystem. Can also be used for incremental fetching for ongoing synchronisation of SimpleDB.

## Example

```js
var simpledb2level = require('simpledb2level')
var awsConfig = {
    'accessKeyId'     : 'access key'
  , 'secretAccessKey' : 'secret access key'
  , 'region'          : 'ap-northeast-1'
}
var dbPath = __dirname + '/simple.db'

simpledb2level({ aws: awsConfig, db: dbPath })
```

## API *("But wait! There's more!")*

`simpledb2level(options)` where `options` can contain:

 * `'aws'` - *(required)* - the AWS config for [aws-sdk](https://github.com/aws/aws-sdk-js).
 * `'db'` - *(required)* - the LevelDB store to write to. Can be either a `String` path which will be opened and closed as required, or a [LevelUP](https://github.com/rvagg/node-levelup) instance (or LevelUP-like instance), which won't be explicitly closed when the streaming is finished.
 * `'domains'` - *(optional)* - an `Array` of `String`s that, if supplied, will be used to restrict the domains that are copied. If you have lots of domains and only want to copy some, supply a list.
 * `'domainConfig'` - *(optional)* - a `Function` that will be called *for each domain* that can be used to return domain-specific configuration. More on this below.

### `'domainConfig'`

If you need to do special things with particular domains then you can do it with this special callback-like function that you supply on the options.

Return an `Object` that has the following optional properties:

 * `'criteria'` - select criteria that is supplied to [simpledb-stream](https://github.com/rvagg/simpledb-stream) for this domain. Use this to restrict the data being read. If you want to do **incremental** copying then provide a `'criteria'` that will select only the most recent data.
 * `'setupDb'` - a `Function` that can be used to adjust the [sublevel](https://github.com/dominictarr/level-sublevel) that the data will be written to. The function should accept a `db` and return a `db` (likely the same object, but it can be something else). Use this if you want to set up indexes or other features on the `db` while the data is being written.

```js
const simpledb2level = require('simpledb2level')
    , secondary = require('level-secondary')
    , awsConfig = { ... }

var s2l = simpledb2level({
    aws          : awsConfig
  , db           : './out.db'
  , domains      : [ 'OnlyOneDomain' ]
  , domainConfig : function (domain) {
      return {
          criteria : 'time != "0" and time > "2013-12-20"'
        , setupDb  : function (db) {
            secondary(db, 'time')
            return db
          }
      }
    }
)
```

### Events

`simpledb2level()` returns an `EventEmitter` that can be used to get more insight to what's going on.

 * `'error'` - as you would expect, an error occurred
 * `'end'` - reading and writing is finished
 * `'domains'` - emits an `Array` of domains found in SimpleDB that will be streamed to LevelDB (this list will be modified if you supply a `'domains'` option).
 * `'domain'` - emits an object containing:
   - `'domain'` - the name of the domain
   - `'stream'` - a [simpledb-stream](https://github.com/rvagg/simpledb-stream) that will be used to stream data out of this domain
   - `'config'` - the config obtained from the `'domainConfig'` function option (if any).

You can use the `'stream'` for each domain to track progress if required.

## LevelDB write structure

Each domain from SimpleDB will be written into a [sublevel](https://github.com/dominictarr/level-sublevel) with the same name. Then each item in that domain will be written such that `'Name'` becomes the key and the value is a JSON object where each attribute `'Name'` / '`Value'` pair is a property / value.

You can get hacky with the `setupDb` function to adjust how this works, but if you need more flexibility then open a pull request!

## Tests

To execute the tests you need a **test/aws-config.json** file with your AWS credentials. The test suite will create a SimpleDB domain, test the streaming, then delete the test domain.

The test/aws-config.json file should look something like this:

```json
{
    "accessKeyId"     : "access key"
  , "secretAccessKey" : "secret key"
  , "region"          : "ap-southeast-2"
}
```

## License

**simpledb2level** is Copyright (c) 2013 Rod Vagg [@rvagg](https://twitter.com/rvagg) and licenced under the MIT licence. All rights not explicitly granted in the MIT license are reserved. See the included LICENSE file for more details.
