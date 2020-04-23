'use strict';

// import

const escapeSQLIdentifier = require('./escape-sql-identifier');

// export

module.exports = buildSQLText;

// functions

function buildSQLText(sqlTemplate, parameters, serializeToSQLValue) {
	return (
		sqlTemplate
			.replace(/\$\$\((.*?)\)/g, (_, key) => escapeSQLIdentifier(getSQLParameter(key)))
			.replace(/[^\$]\$\((.*?)\)/g, (match, key) => {
				return match[0] + serializeToSQLValue(getSQLParameter(key));
			})
	);
	
	// functions
	
	function getSQLParameter(key) {
		if(!(key in parameters)) {
			throw Error('missing key: ' + JSON.stringify(key) + ' in parameters');
		}
		return parameters[key];
	}
}
