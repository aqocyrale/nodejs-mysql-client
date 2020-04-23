'use strict';

// export

module.exports = {
	isNull: it => it === null,
	isBoolean: it => typeof it === 'boolean',
	isNumber: it => typeof it === 'number' && !isNaN(it) && isFinite(it),
	isInteger: Number.isInteger,
	isString: it => typeof it === 'string',
	isArray: Array.isArray,
	isObject: it => it !== null && typeof it === 'object' && !Array.isArray(it),
	isArrayOf: (it, isArrayValueOk) => {
		if(!Array.isArray(it)) return false;
		for(let i = 0, { length } = it; i < length; ++i) {
			if(!isArrayValueOk(it[i])) return false;
		}
		return true;
	},
	isObjectOf: (it, isObjectValueOk) => {
		if(!(it !== null && typeof it === 'object' && !Array.isArray(it))) return false;
		for(const key in it) {
			if(!Object.prototype.hasOwnProperty.call(it, key)) continue;
			if(!isObjectValueOk(it[key])) return false;
		}
		return true;
	},
	isFunction: it => typeof it === 'function',
	isUndefined: it => typeof it === 'undefined',
	isSymbol: it => typeof it === 'symbol',
};
