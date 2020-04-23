'use strict';

// import

const getQueryArguments = require('./get-query-arguments');
const assignError = require('./assign-error');
const OkPacket = require('./ok-packet');

// export

module.exports = Transaction;

// functions

function Transaction(mysqlConnection) {
	
	// public
	
	Object.assign(this, {
		query,
		insert,
		setAutoCommit,
		rollback,
		commit,
	});
	
	// functions
	
	function query(...args) {
		const callerError = Error();
		try {
			const [ sqlTemplate, parameters, options, callback ] = getQueryArguments(args);
			mysqlConnection.query(sqlTemplate, parameters, options, (error, result) => {
				callback(assignError(callerError, error), result);
			});
		} catch(error) {
			throw assignError(callerError, error);
		}
	}
	
	function insert(options, callback) {
		const callerError = Error();
		mysqlConnection.insert(options, (error, result) => {
			callback(assignError(callerError, error), result);
		});
	}
	
	function setAutoCommit(isOn, callback) {
		const callerError = Error();
		mysqlConnection.query('set autocommit = ' + (isOn ? '1' : '0'), error => {
			callback(assignError(callerError, error));
		});
	}
	
	function rollback(callback) {
		const callerError = Error();
		mysqlConnection.query('rollback', error => {
			mysqlConnection.release();
			callback(assignError(callerError, error));
		});
	}
	
	function commit(callback) {
		const callerError = Error();
		mysqlConnection.query('commit', error => {
			mysqlConnection.release();
			callback(assignError(callerError, error));
		});
	}
}
