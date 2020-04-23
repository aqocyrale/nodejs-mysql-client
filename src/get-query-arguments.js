'use strict';

// import

const { isNumber, isInteger, isString, isObject, isFunction } = require('./type-tests');
const getQueryOptions = require('./get-query-options');

// export

module.exports = getQueryArguments;

// functions

function getQueryArguments(args) {
	const [ sqlTemplate, parameters, options, callback ] = unpackQueryArguments(args);
	if(!isString(sqlTemplate)) {
		throw Object.assign(Error('sqlTemplate must be string'), { sqlTemplate });
	}
	if(!isObject(parameters)) {
		throw Object.assign(Error('parameters must be object'), { parameters });
	}
	if(!isFunction(callback)) {
		throw Object.assign(Error('callback must be function'), { callback });
	}
	return [ sqlTemplate, parameters, getQueryOptions(options), callback ];
}

function unpackQueryArguments(args) {
	switch(args.length) {
		case 2: return [ args[0], {}, {}, args[1] ];
		case 3: return [ args[0], args[1], {}, args[2] ];
		case 4: return [ args[0], args[1], args[2], args[3] ];
		default: throw Object.assign(Error('invalid query argument count, must be 2 or 3 or 4'), {
			argumentCount: args.length,
			arguments: args,
		});
	}
}
