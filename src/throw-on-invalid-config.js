'use strict';

// import

const { isNull, isNumber, isInteger, isString } = require('./type-tests');
const assignError = require('./assign-error');

// export

module.exports = throwOnInvalidConfig;

// functions

function throwOnInvalidConfig({
	host,
	port,
	username,
	password,
	database,
	minConnections,
	maxConnections,
	endConnectionOnIdleMs,
}, error) {
	if(!isString(host)) throw assignError(error, {
		message: 'host must be string',
		host,
	});
	if(!isInteger(port)) throw assignError(error, {
		message: 'port must be integer',
		port,
	});
	if(!(port >= 1 && port <= 65535)) throw assignError(error, {
		message: 'port must be in range 1 to 65535',
		port,
	});
	if(!isString(username)) throw assignError(error, {
		message: 'username must be string',
		username,
	});
	if(!isString(password)) throw assignError(error, {
		message: 'password must be string',
		password,
	});
	if(!(isString(database) || isNull(database))) throw assignError(error, {
		message: 'database must be string or null',
		database,
	});
	if(!isInteger(minConnections)) throw assignError(error, {
		message: 'minConnections must be integer',
		minConnections,
	});
	if(!(minConnections >= 0)) throw assignError(error, {
		message: 'minConnections must be >= 0',
		minConnections,
	});
	if(!isInteger(maxConnections)) throw assignError(error, {
		message: 'maxConnections must be integer',
		maxConnections,
	});
	if(!(maxConnections >= 0)) throw assignError(error, {
		message: 'maxConnections must be >= 0',
		maxConnections,
	});
	if(!(maxConnections >= minConnections)) throw assignError(error, {
		message: 'maxConnections must be >= minConnections',
		minConnections,
		maxConnections,
	});
	if(!isNumber(endConnectionOnIdleMs)) throw assignError(error, {
		message: 'endConnectionOnIdleMs must be number',
		endConnectionOnIdleMs,
	});
	if(!(endConnectionOnIdleMs >= 0)) throw assignError(error, {
		message: 'endConnectionOnIdleMs must be >= 0',
		endConnectionOnIdleMs,
	});
}
