'use strict';

// import

const assignMySQLError = require('./assign-mysql-error');
const OkPacket = require('./ok-packet');

// static

const READ_STATE_HEADER = Symbol('READ_STATE_HEADER');
const READ_STATE_COLUMN = Symbol('READ_STATE_COLUMN');
const READ_STATE_ROW = Symbol('READ_STATE_ROW');

// export

module.exports = ComQueryResponse;

// functions

function ComQueryResponse(decodeRecordValue, callback) {
	
	// state
	
	let readState = READ_STATE_HEADER;
	let columnCount = 0;
	const columns = [];
	const rows = [];
	let offset = 0;
	let minBufferByteLength = 0;
	
	// public
	
	Object.assign(this, {
		pushPacket,
	});
	
	// functions
	
	function pushPacket(payload) {
		switch(readState) {
			case READ_STATE_HEADER: return onHeader(payload);
			case READ_STATE_COLUMN: return onColumn(payload);
			case READ_STATE_ROW: return onRowOrEOF(payload);
		}
	}
	
	function onHeader(payload) {
		if(payload.byteLength < 1) return onError(Error('invalid buffer length'), {
			code: 'ERR_BUFFER_SIZE',
		});
		switch(payload[0]) {
			case 0xFF: // Error
				return onError(assignMySQLError(Error(), payload));
			case 0x00: // Ok
			case 0xFE: // EOF(Ok)
				return createOkPacket(payload, (error, okPacket) => {
					if(error) return onError(error);
					onDone(okPacket);
				});
			default: // Text Resultset Column Count
				columnCount = payload[0];
				readState = READ_STATE_COLUMN;
		}
	}
	
	function onColumn(payload) {
		offset = 0;
		minBufferByteLength = 0;
		
		const catalog = readLenEnc(payload, 'utf8');
		if(catalog === null) return;
		const schema = readLenEnc(payload, 'utf8');
		if(schema === null) return;
		const virtualTableName = readLenEnc(payload, 'utf8');
		if(virtualTableName === null) return;
		const physicalTableName = readLenEnc(payload, 'utf8');
		if(physicalTableName === null) return;
		const virtualColumnName = readLenEnc(payload, 'utf8');
		if(virtualColumnName === null) return;
		const physicalColumnName = readLenEnc(payload, 'utf8');
		if(physicalColumnName === null) return;
		
		// skip length of fixed length fields, (always 12?)
		offset += getLengthEncodedIntegerSize(payload[offset]);
		
		const characterSet = payload.readUIntLE(offset, 2);
		offset += 2;
		const maxByteLength = payload.readUIntLE(offset, 4);
		offset += 4;
		const typeEnum = payload.readUIntLE(offset, 1);
		offset += 1;
		const flags = payload.readUIntLE(offset, 2);
		offset += 2;
		const decimals = payload.readUIntLE(offset, 1);
		
		columns.push({
			catalog,
			schema,
			virtualTableName,
			physicalTableName,
			virtualColumnName,
			physicalColumnName,
			characterSet,
			maxByteLength,
			typeEnum,
			flags,
			decimals,
		});
		if(columns.length === columnCount) {
			readState = READ_STATE_ROW;
		}
	}
	
	function onRowOrEOF(payload) {
		if(payload.byteLength < 1) return onError(Error('invalid buffer length'), {
			code: 'ERR_BUFFER_SIZE',
		});
		switch(payload[0]) {
			case 0xFF: // Error
				return onError(assignMySQLError(Error(), payload));
			case 0x00: // Ok
			case 0xFE: // EOF(Ok)
				return onEOF(payload);
			default: // Text Resultset Column Count
				return onRow(payload);
		}
	}
	
	function onRow(payload) {
		offset = 0;
		minBufferByteLength = 0;
		
		const values = [];
		for(let i = 0; true; ++i) {
			if(offset >= payload.byteLength) {
				rows.push(values);
				break;
			}
			if(payload[offset] === 0xFB) {
				values.push(null);
				++offset;
				continue;
			}
			const value = readLenEnc(payload);
			if(value === null) return;
			if(i >= columns.length) {
				onError(Error('invalid server column count in row in text result set'), {
					code: 'ERR_SERVER_RESULTSET',
				});
				return;
			}
			values.push(decodeRecordValue(value, columns[i]));
		}
	}
	
	function onEOF(payload) {
		onDone(new TextResultSet(
			columns.map(it => it.virtualColumnName),
			rows,
		));
	}
	
	function onError(error, assign = {}) {
		if(callback !== null) {
			callback(Object.assign(error, assign));
			callback = null;
		}
	}
	
	function onDone(result) {
		if(callback !== null) {
			callback(null, result);
			callback = null;
		}
	}
	
	function readLenEnc(buffer, encoding = null) {
		const size = getLengthEncodedIntegerSize(buffer[offset]);
		minBufferByteLength += size;
		if(buffer.byteLength < minBufferByteLength) {
			onError(Error('invalid buffer length'), {
				code: 'ERR_BUFFER_SIZE',
			});
			return null;
		}
		const length = readLengthEncodedInteger(buffer, offset, size);
		const newOffset = offset + size + length;
		const readBuffer = buffer.slice(offset + size, newOffset);
		offset = newOffset;
		return encoding === null ? readBuffer : readBuffer.toString(encoding);
	}
}

function createOkPacket(payload, callback) {
	let minBufferByteLength = 1 + 2 + 2;
	if(!isBufferLengthSafe()) return;
	
	let offset = 1;
	const size1 = getLengthEncodedIntegerSize(payload[offset]);
	minBufferByteLength += size1;
	if(!isBufferLengthSafe()) return;
	const affectedRows = readLengthEncodedInteger(payload, offset, size1);
	offset += size1;
	
	const size2 = getLengthEncodedIntegerSize(payload[offset]);
	minBufferByteLength += size2;
	if(!isBufferLengthSafe()) return;
	const lastInsertId = readLengthEncodedInteger(payload, offset, size2);
	offset += size2;
	
	callback(null, new OkPacket({
		affectedRows,
		lastInsertId,
		statusFlags: payload.readUIntLE(offset, 2),
		warningCount: payload.readUIntLE(offset + 2, 2),
	}));
	
	// functions
	
	function isBufferLengthSafe() {
		if(payload.byteLength < minBufferByteLength) {
			callback(Object.assign(Error('invalid buffer length'), {
				code: 'ERR_BUFFER_SIZE',
			}));
			return false;
		}
		return true;
	}
}

function TextResultSet(columns, rows) {
	let list = null;
	
	// public
	
	Object.assign(this, {
		length: rows.length,
		asTable,
		asList,
	});
	
	// functions
	
	function asTable() {
		return { columns, rows };
	}
	
	function asList() {
		if(list === null) list = tableToList(columns, rows);
		return list;
	}
}

function tableToList(columns, rows) {
	const { length } = columns;
	return rows.map(it => {
		const object = {};
		for(let i = 0; i < length; ++i) {
			object[columns[i]] = it[i];
		}
		return object;
	});
}

function getLengthEncodedIntegerSize(firstByte) {
	switch(firstByte) {
		case 255: throw Error('invalid first byte for length encoded integer');
		case 254: return 9;
		case 253: return 4;
		case 252: return 3;
		default: return 1;
	}
}

function readLengthEncodedInteger(buffer, offset, size) {
	switch(size) {
		case 1: return buffer[offset];
		case 3: return buffer.readUIntLE(offset + 1, 2);
		case 4: return buffer.readUIntLE(offset + 1, 3);
		case 9: return Number(buffer.readBigUInt64LE(offset + 1));
	}
}
