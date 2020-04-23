'use strict';

// import

const { isNumber, isInteger, isString, isObject, isFunction } = require('./type-tests');

// export

module.exports = escapeSQLIdentifier;

// functions

function escapeSQLIdentifier(string) {
	if(!isString(string)) throw Object.assign(Error('sql identifier must be string'), {
		sqlIdentifier: string,
	});
	return '`' + string.replace(/`/g, '``') + '`';
}
