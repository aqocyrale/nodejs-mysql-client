'use strict';

// import

const {
	isNull,
	isBoolean,
	isNumber,
	isString,
	isArray,
	isObject,
} = require('./type-tests');
const escapeSQLStringValue = require('./escape-sql-string-value');

// export

module.exports = serializeToSQLValue;

// functions

function serializeToSQLValue(any) {
	if(isNull(any) || isBoolean(any) || isNumber(any)) return any + '';
	if(isString(any)) return escapeSQLStringValue(any);
	if(isArray(any)) return any.map(serializeToSQLValue).join(',');
	if(any instanceof Date) {
		return "'" + any.toISOString().slice(0, 19).replace('T', ' ') + "'";
	}
	if(isObject(any)) return escapeSQLStringValue(JSON.stringify(any));
	throw Error('cannot serialize value into an sql value: ' + any);
}
