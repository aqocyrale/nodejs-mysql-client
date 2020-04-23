'use strict';

// import

const { isNumber, isInteger, isObject, isFunction } = require('./type-tests');

// static

const DEFAULT_QUERY_OPTIONS = {
	retryOn: error => false,
	maxRetries: 0,
	minRetryDelayMs: 0,
	maxRetryDelayMs: 100,
};

// export

module.exports = getQueryOptions;

// functions

function getQueryOptions(options) {
	if(!isObject(options)) {
		throw Object.assign(Error('options must be object'), { options });
	}
	const completeOptions = Object.assign(Object.create(null), DEFAULT_QUERY_OPTIONS, options);
	if(!(isFunction(completeOptions.retryOn))) {
		throw Object.assign(Error('options.retryOn must be function'), { options });
	}
	if(!(isInteger(completeOptions.maxRetries))) {
		throw Object.assign(Error('options.maxRetries must be integer'), { options });
	}
	if(!(completeOptions.maxRetries >= 0)) {
		throw Object.assign(Error('options.maxRetries must be >= 0'), { options });
	}
	if(!(isNumber(completeOptions.minRetryDelayMs))) {
		throw Object.assign(Error('options.minRetryDelayMs must be number'), { options });
	}
	if(!(isNumber(completeOptions.maxRetryDelayMs))) {
		throw Object.assign(Error('options.maxRetryDelayMs must be number'), { options });
	}
	return completeOptions;
}
