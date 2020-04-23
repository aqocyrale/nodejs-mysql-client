'use strict';

// import

const Path = require('path');
const FileSystem = require('fs');

// state

const map = new Map();

// run

/**
	@doc
		https://dev.mysql.com/doc/refman/5.7/en/server-error-reference.html
	@extract
Array.from(document.querySelectorAll('ul.itemizedlist')[0].children).map(it => {
	const [ number, symbol, state ] = Array
		.from(it.querySelectorAll('.literal'))
		.slice(0, 3)
		.map(it => it.textContent);
	return number + ',' + symbol;
}).join('\n');

*/
FileSystem.readFileSync(Path.join(__dirname, 'error-code-symbol-map.csv'), 'utf8')
	.trim()
	.split('\n')
	.forEach(it => {
		const parts = it.trim().split(',');
		map.set(Number(parts[0]), parts[1]);
	});

// export

module.exports = getErrorCodeSymbol;

// functions

function getErrorCodeSymbol(code) {
	return map.get(code) || 'ER_UNKNOWN';
}
