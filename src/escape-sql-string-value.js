'use strict';

// static

const SQL_ESCAPE_MAP = {
	'\0': '\\0',
	"'": "\\'",
	'"': '\\"',
	'\b': '\\b',
	'\n': '\\n',
	'\r': '\\r',
	'\t': '\\t',
	'\x1a': '\\Z',
	'\\': '\\\\',
};

// export

module.exports = escapeSQLStringValue;

// functions

function escapeSQLStringValue(string) {
	return "'" + string.replace(/[\0\'\"\b\n\r\t\x1a\\]/g, it => SQL_ESCAPE_MAP[it]) + "'";
}
