'use strict';

// import

const getQueryArguments = require('./get-query-arguments');
const buildSQLText = require('./build-sql-text');
const assignError = require('./assign-error');
const MySQLClientSocket = require('./mysql-client-socket');
const escapeSQLIdentifier = require('./escape-sql-identifier');
const OkPacket = require('./ok-packet');

// export

module.exports = MySQLConnection;

// functions

function MySQLConnection({
	host,
	port,
	username,
	password,
	database,
	onHandshake,
	onRelease,
	onDisconnect,
	serializeToSQLValue,
	decodeRecordValue,
}) {
	const This = this;
	
	// state
	
	const mysqlClientSocket = new MySQLClientSocket({
		host,
		port,
		username,
		password,
		database,
		onHandshake: onHandshakeInternal,
		onDisconnect,
		decodeRecordValue,
	});
	
	// public
	
	Object.assign(this, {
		connectionId: null,
		query,
		insert,
		release,
		disconnect: mysqlClientSocket.disconnect,
	});
	
	// functions.public
	
	function query(...args) {
		const callerError = Error();
		try {
			const [ sqlTemplate, parameters, options, callback ] = getQueryArguments(args);
			executeComQueryWithRetry(
				buildSQLText(sqlTemplate, parameters, serializeToSQLValue),
				options,
				(error, result) => {
					if(error) return callback(assignError(callerError, error));
					callback(null, result);
				},
			);
		} catch(error) {
			throw assignError(callerError, error);
		}
	}
	
	function insert({ into, columns = [], rows = [], values = [] }, callback) {
		const rowsLength = rows.length;
		if(rowsLength === 0) {
			if(values.length === 0) {
				return callback(null, new OkPacket());
			}
		} else {
			const columnsLength = columns.length;
			for(let i = 0; i < rowsLength; ++i) {
				const object = Object.create(null);
				const row = rows[i];
				for(let j = 0; j < columnsLength; ++j) {
					object[columns[j]] = row[j];
				}
				values.push(object);
			}
		}
		
		const callerError = Error();
		const orderedKeys = Object.keys(values[0]);
		const orderedKeysLength = orderedKeys.length;
		mysqlClientSocket.comQuery((
			'insert into ' + escapeSQLIdentifier(into) +
			' (' + orderedKeys.join(',') +
			') values ' + values.map(it => {
				const recordValues = [];
				for(let i = 0; i < orderedKeysLength; ++i) {
					recordValues.push(serializeToSQLValue(it[orderedKeys[i]]));
				}
				return '(' + recordValues.join(',') + ')';
			}).join(',')
		), (error, result) => {
			if(error) return callback(assignError(callerError, error));
			callback(null, result);
		});
	}
	
	function release() {
		onRelease();
	}
	
	// functions.private
	
	function onHandshakeInternal(error) {
		This.connectionId = mysqlClientSocket.connectionId;
		onHandshake(error);
	}
	
	function executeComQueryWithRetry(sqlText, options, callback) {
		const { retryOn, maxRetries, minRetryDelayMs, maxRetryDelayMs } = options;
		const errors = [];
		tryQuery(0);
		
		// functions
		
		function tryQuery(i) {
			mysqlClientSocket.comQuery(sqlText, (error, result) => {
				if(!error) return callback(null, result);
				if(maxRetries === 0) return callback(error);
				
				errors.push(error);
				
				if(i >= maxRetries) {
					errors.forEach(it => {
						delete it.stack;
					});
					return callback(Object.assign(Error('retry count exceeded'), {
						code: 'ERR_MAX_RETRIES',
						maxRetries,
						errors,
					}));
				}
				
				if(retryOn(error)) {
					setTimeout(
						tryQuery,
						minRetryDelayMs + Math.random() * (maxRetryDelayMs - minRetryDelayMs),
						i + 1,
					);
				} else {
					callback(error);
				}
			});
		}
	}
}
