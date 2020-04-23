'use strict';

// export

module.exports = decodeRecordValue;

// functions

function decodeRecordValue(value, column) {
	switch(column.typeEnum) {
		
		// typeEnums in MySQL 5.6/5.7/8.0
		
		case 16: // bit
			if(column.maxByteLength === 1) return value[0] !== 0; // bit(1) as boolean
			return value; // buffer
		
		case 1: // tinyInt
			if(column.maxByteLength === 1) return value[0] !== 0; // tinyInt(1) as boolean
		case 2: // smallInt
		case 9: // mediumInt
		case 3: // int
		case 8: // bigInt
		case 246: // decimal
		case 4: // float
		case 5: // double
		case 13: // year
			return Number(value.toString('utf8')); // NaN
		
		case 10: // date
		case 12: // datetime
		case 7: // timestamp
			return new Date(value.toString('utf8')); // Invalid Date
		
		case 11: // time
			return value.toString('utf8');
		
		case 254: // char(0) | binary(128) | enum(256) | set(2048)
		case 253: // varchar(0) | varbinary(128)
		case 252: // text(all) | blob(all)
			if(column.flags & 128) return value; // binary
			return value.toString('utf8'); // incorrect encoding
		
		case 245: // json
			try {
				return JSON.parse(value.toString('utf8'));
			} catch(error) {
				return error;
			}
		
		case 255: // geometry
			return value; // buffer
		
		// unused/deprecated/unsupported typeEnums in MySQL 5.6+
		
		case 6: // NULL?
		case 0: // DECIMAL?
		case 17: // TIMESTAMP2?
		case 15: // VARCHAR?
		case 249: // TINY_BLOB?
		case 250: // MEDIUM_BLOB?
		case 251: // LONG_BLOB?
		case 247: // ENUM?
		case 248: // SET?
		default:
			return value; // buffer
	}
}
