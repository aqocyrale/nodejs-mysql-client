'use strict';

// import

const Transaction = require('./transaction');
const getQueryArguments = require('./get-query-arguments');
const throwOnInvalidConfig = require('./throw-on-invalid-config');
const assignError = require('./assign-error');
const removeArrayFirstValueIfExists = require('./remove-array-first-value-if-exists');
const MySQLConnection = require('./mysql-connection');
const serializeToSQLValue = require('./serialize-to-sql-value');
const decodeRecordValue = require('./decode-record-value');
const OkPacket = require('./ok-packet');

// static

const DEFAULT_CONFIG = {
	host: 'localhost',
	port: 3306,
	username: 'root',
	password: '',
	database: null,
	minConnections: 2,
	maxConnections: 8,
	endConnectionOnIdleMs: 1000 * 60 * 5, // 5 minutes
	serializeToSQLValue,
	decodeRecordValue,
};

// export

module.exports = MySQLClient;

// functions

function MySQLClient(constructorConfig = DEFAULT_CONFIG) {
	
	// state
	
	let config = Object.assign(Object.create(null), DEFAULT_CONFIG, constructorConfig);
	const mysqlConnectionsSet = new Set();
	const idleConnectionsQueue = []; // 0 = first
	const getConnectionCallbacksQueue = []; // 0 = first
	const mysqlConnectionToTimeoutIdMap = new Map();
	
	// run
	
	throwOnInvalidConfig(config, Error());
	
	// public
	
	Object.assign(this, {
		configure,
		getConnection,
		query,
		insert,
		begin,
	});
	
	// functions.public
	
	function configure(newConfig = {}) {
		const updates = Object.create(null);
		for(const key in config) {
			if(key in newConfig && newConfig[key] !== config[key]) {
				updates[key] = newConfig[key];
			}
		}
		const updatedConfig = Object.assign(Object.create(null), config, updates);
		throwOnInvalidConfig(updatedConfig, Error());
		config = updatedConfig;
		
		idleConnectionsQueue.forEach(it => it.disconnect());
	}
	
	function getConnection(callback) {
		const callerError = Error();
		
		if(idleConnectionsQueue.length > 0) {
			const mysqlConnection = idleConnectionsQueue.pop();
			clearTimeout(mysqlConnectionToTimeoutIdMap.get(mysqlConnection));
			callback(null, mysqlConnection);
			return;
		}
		
		if(mysqlConnectionsSet.size >= config.maxConnections) {
			getConnectionCallbacksQueue.push(callback);
			return;
		}
		
		const thisConfig = config;
		const { host, port, username, password, database } = config;
		const mysqlConnection = new MySQLConnection({
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
		});
		mysqlConnectionsSet.add(mysqlConnection);
		
		// functions
		
		function onHandshake(error) {
			if(error) return callback(assignError(callerError, error));
			callback(null, mysqlConnection);
		}
		
		function onRelease() {
			if(thisConfig !== config) {
				mysqlConnection.disconnect();
				if(getConnectionCallbacksQueue.length > 0) {
					getConnection(getConnectionCallbacksQueue.shift());
				}
				return;
			}
			
			if(getConnectionCallbacksQueue.length > 0) {
				getConnectionCallbacksQueue.shift()(null, mysqlConnection);
				return;
			}
			
			idleConnectionsQueue.push(mysqlConnection);
			
			mysqlConnectionToTimeoutIdMap.set(mysqlConnection, setTimeout(() => {
				if(idleConnectionsQueue.length > config.minConnections) {
					mysqlConnection.disconnect();
				}
			}, config.endConnectionOnIdleMs));
		}
		
		function onDisconnect() {
			removeArrayFirstValueIfExists(idleConnectionsQueue, mysqlConnection);
			mysqlConnectionsSet.delete(mysqlConnection);
		}
	}
	
	function query(...args) {
		const callerError = Error();
		try {
			const [ sqlTemplate, parameters, options, callback ] = getQueryArguments(args);
			getConnection((error, mysqlConnection) => {
				if(error) return callback(assignError(callerError, error));
				mysqlConnection.query(sqlTemplate, parameters, options, (error, result) => {
					mysqlConnection.release();
					callback(assignError(callerError, error), result);
				});
			});
		} catch(error) {
			throw assignError(callerError, error);
		}
	}
	
	function insert(options, callback) {
		const callerError = Error();
		getConnection((error, mysqlConnection) => {
			if(error) return callback(assignError(callerError, error));
			mysqlConnection.insert(options, (error, result) => {
				mysqlConnection.release();
				callback(assignError(callerError, error), result);
			});
		});
	}
	
	function begin(callback) {
		const callerError = Error();
		getConnection((error, mysqlConnection) => {
			if(error) return callback(assignError(callerError, error));
			mysqlConnection.query('begin', error => {
				if(error) return callback(assignError(callerError, error));
				callback(null, new Transaction(mysqlConnection));
			});
		});
	}
}
