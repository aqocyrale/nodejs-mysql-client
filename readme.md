# [nodejs] [@aqo/mysql-client] [1.0.0]

## Install @ npm
```shell
npm install github:aqocyrale/nodejs-mysql-client
```

## Import @ nodejs
```js
require('@aqo/mysql-client')
```

## Description
Creates a client that provides an interface from Node.js code to send commands to a MySQL server.

## Supports
- connection pooling with on-demand loading and releasing
- configuration can be updated without a client restart
- insert query builder (works with objects and with arrays)
- transaction helper (begin, autocommit, rollback, commit)
- query retry options (for auto-retry where needed)
- configurable codecs (for advanced users, for configuring binary types auto-decoders and more)
- configutable select expanding (as arrays (compact) or as objects (simple))
- queries larger than 16Mb

## Examples
```js
'use strict';

// import

const MySQLClient = require('@aqo/mysql-client');

// create client

const mysqlClient = new MySQLClient({
    host: 'localhost',
    port: 3306,
    username: 'my_username',
    password: 'my_password',
    database: 'my_default_database',
});

// select query

mysqlClient.query((`
    select
        users.email,
        user_details.name
    from users
    left join user_details on
        user_details.user_id = users.id
    limit 10
`), (error, result) => {
    if(error) return console.error(error);
    console.log('rowsFoundCount:', result.length);
    console.log('listResult:', result.asList()); // [ { email: '...', name: '...' }, ... ]
    // list format is the default format to use if you only work with this data in your code
});

// select query with parameters

mysqlClient.query((`
    select *
    from $$(table)
    where
        created_at > $(date) and
        $$(column) in ($(values))
`), {
    table: 'my_table',
    column: 'my_column',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24),
    values: [ 1, 2, 3 ],
}, (error, result) => {
    if(error) return console.error(error);
    console.log('tableResult:', result.asTable()); // { columns: [ '?'... ], rows: [ [?]... ] }
    // table format is more compact, in case you want to serialize and transfer this data
});

// insert array of objects (easier to work with if you generate objects in your code)

mysqlClient.insert({
    into: 'my_table',
    values: [
        { column01: 'value1-1', column02: 'value1-2', },
        { column01: 'value2-1', column02: 'value2-2', },
    ],
}, (error, result) => {
    if(error) return console.error(error);
    console.log('insertResult:', result); // affectedRows, lastInsertId, ...
});

// insert array of arrays with columns header (in case you already have the data in this format)

mysqlClient.insert({
    into: 'my_table',
    columns: [ 'column01', 'column02' ],
    rows: [
        [ 'value1-1', 'value1-2' ],
        [ 'value2-1', 'value2-2' ],
    ],
}, (error, result) => {
    if(error) return console.error(error);
    console.log('insertResult:', result); // affectedRows, lastInsertId, ...
});

// change client configuration (has no effect on running queries, only on new connections)

mysqlClient.configure({
    database: 'my_other_database',
    minConnections: 0, // the client will be idle once all queries resolve
    maxConnections: 4, // limit connection pool size
    endConnectionOnIdleMs: 10, // don't recycle connections that were idle for longer than 10ms
});

// run a transaction

mysqlClient.begin((error, transaction) => {
    if(error) return console.error(error);
    
    transaction.setAutoCommit(false, error => {
        if(error) return onTransactionError(error);
        
        transaction.query((`
            delete
            from my_table
            where id > $(minId)
        `), { minId: 0 }, (error, result) => {
            if(error) return onTransactionError(error);
            
            transaction.commit(error => {
                // even if commit fails, the connection returns to the pool (or dies)
                if(error) return console.error(error);
            });
        });
    });
    
    function onTransactionError(error) {
        // this is a very simplified example, use logic appropriate for your app
        // however you must call .rollback or .commit to release the connection back to the pool
        console.error(error);
        transaction.rollback(error => {
            if(error) return console.error(error);
        });
    }
});
```

## Interface
```js
//[ MySQLClient.constructor ]

new MySQLClient({
    // connection
    host: String, // default 'localhost'
    port: Integer, // default 3306
    // auth
    username: String, // default 'root'
    password: String, // default ''
    // default database for queries (if any)
    database: String | null, // default null
    // pool options
    minConnections: Integer, // default 2
    maxConnections: Integer, // default 8
    endConnectionOnIdleMs: Number, // default 1000 * 60 * 5 (5 minutes)
    // codec options
    serializeToSQLValue: (it: Any) => String, // has default implementation
    decodeRecordValue: (value: Buffer, column: Object) => Any, // has default implementation
} | undefined) /*
    - serializeToSQLValue: converts js types into sql text,
        for example `new Date()` to '2012-12-12 12:12:12'
        use this if you want to change/add default serialization for non-string types
    - decodeRecordValue: converts server buffer responses into js types
        for example ByteArray<5, 104, 101, 108, 108, 111> and column.typeEnum=VARCHAR to "hello"
        use this if you want to add auto-decoders into custom classes from binary types
    - warning: don't change codec options unless you know what you're doing,
        the defaults should be fine for most users.
        changing them may result in confusing behavior for future maintainers
*/

//[ MySQLClient.public ]

.configure(...) /*
    - same configuration options as the constructor
    - does not interrupt ongoing queries or held connections
    - all new connections will use the new configuration
*/

.getConnection(
    callback: (
        error: Error | null,
        mysqlConnection: MySQLConnection | undefined,
    ) => undefined
) /*
    - returns a mysql connection with the current configuration,
      or error if it's not possible to establish a connection with this configuration
    - this connection is held and exhausts resources in the client's connection pool,
      you must release this connection manually when you are finished with it
    - you're generally not supposed to use this, just query or insert on the client directly,
      it will select a random connection from the pool internally
*/

.query(
    sqlText: String, // query text, has to be valid sql
    callback: (
        error: Error | null,
        result: OkPacket | TextResultSet | undefined,
    ) => undefined, // called with query result or error on resolution
) /*
    - one random pool connection will be held until the query resolves
    - if there are no free pool connections, the query will be queued until one becomes available
*/

.query(
    sqlTemplate: String, // template text to create an sqlText from
    parameters: Object<String, Any>, // will be injected into the sqlTemplate
    callback: (
        error: Error | null,
        result: OkPacket | TextResultSet | undefined,
    ) => undefined,
) /*
    - parameters are injected into sqlTemplate with the following pattern:
      $(value) is escaped as an SQL value (e.g. "don't" -> "'don''t'")
      $$(identifier) is escaped as an SQL identifier (e.g. "tab`le" -> "`tab``le`")
*/

.query(
    sqlTemplate: String,
    parameters: Object<String, Any>,
    options: {
        retryOn: (error: Error) => Boolean, // default implementation always returns false
        maxRetries: Integer, // default 0 (0 = no retries, 1 = max two query executions, etc)
        minRetryDelayMs: Number, // default 0
        maxRetryDelayMs: Number, // default 100
    },
    callback: (
        error: Error | null,
        result: OkPacket | TextResultSet | undefined,
    ) => undefined,
) /*
    - retryOn is a function that determines whether to retry the query if it fails, example:
      retryOn: error => error.code === 'ER_LOCK_DEADLOCK'
*/

.insert(
    {
        into: String // table name to insert into
        columns: Array<String>, // optional: must be used if rows is used; column names for rows
        rows: Array<Array<Any>>, // optional: value arrays (values must be same order as columns)
        values: Array<Object<String, Any>> // optional: objects to insert, keys used as columns
    },
    callback: (
        error: Error | null,
        result: OkPacket | undefined,
    ) => undefined
) /*
    - you're supposed to use rows & columns OR values, not both; however using both is allowed
    - empty values & rows is allowed, callback will be called, but no query is sent to the server
    - the first object's keys in values determines the columns to insert for all other values
    - if you use both rows and values in the same call:
        - value keys must be the same as the strings in columns
        - the order between rows and values is undefined, do not rely on it
*/

.begin(
    callback: (
        error: Error | null,
        transaction: Transaction | undefined,
    ) => undefined
) /*
    - holds one connection until you either commit or rollback the transaction
*/

//[ MySQLConnection.public ]

.connectionId: Integer // returned by the MySQL Server
.query(...) // same interface as MySQLClient
.insert(...) // same interface as MySQLClient
.release() // has to be called to return the connection to the owning client's pool
.disconnect() // ends the connection, preventing further reuse (frees up pool resources as well)

//[ TextResultSet.public ]

.length: Integer // count of rows in the result set
.asTable() // get select result as { columns: Array<String>, rows: Array<Array<Any>> } (compact)
.asList() // get select result as Array<Object<String, Any>> (simple)

//[ OkPacket.public ]

.affectedRows: Integer // 0 if no insert was executed
.lastInsertId: Integer // 0 if no insert was executed
.warningCount: Integer
.isInTransaction: Boolean
.isAutoCommitOn: Boolean
.wasDatabaseDropped: Boolean
.isBackslashEscapeDisabled: Boolean
.wasQuerySlow: Boolean
.hasSessionStateChanged: Boolean

//[ Transaction.public ]

.query(...) // same interface as MySQLClient
.insert(...) // same interface as MySQLClient
.setAutoCommit(isOn: Boolean, callback: (error: Error | null) => undefined),
.rollback(callback: (error: Error | null) => undefined)
.commit(callback: (error: Error | null) => undefined) /*
    - both rollback and commit release the underlying connection,
      rendering this transaction no longer usable afterwards
*/

```

## license
# MIT
