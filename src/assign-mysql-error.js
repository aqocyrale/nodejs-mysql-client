'use strict';

// import

const getErrorCodeSymbol = require('./get-error-code-symbol');

// export

module.exports = assignMySQLError;

// functions

function assignMySQLError(error, errorPayload) {
	// assumes CLIENT_PROTOCOL_41 enabled
	
	// prevent buffer overread
	if(errorPayload.byteLength < (1 + 2 + 1 + 5)) {
		error.message = 'invalid mysql error packet';
		error.code = 'ERR_UNKNOWN';
	} else {
		error.sqlCode = errorPayload.readUIntLE(1, 2);
		error.sqlState = errorPayload.slice(4, 9).toString('binary');
		Object.defineProperty(error, 'message', {
			value: errorPayload.slice(9).toString('binary'),
			enumerable: false,
			writable: true,
		});
		error.code = getErrorCodeSymbol(error.sqlCode);
	}
	
	return error;
}
