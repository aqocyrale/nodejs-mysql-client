'use strict';

// import

const createNumberBuffer = require('./create-number-buffer');

// static

const CLIENT_CONNECT_WITH_DB = 2 ** 3;
const CLIENT_PROTOCOL_41 = 2 ** 9;
const CLIENT_TRANSACTIONS = 2 ** 13;
const CLIENT_DEPRECATE_EOF = 2 ** 24;
const CHARACTER_SET_UTF8MB4 = 224;

// export

module.exports = createHandshakeResponse41;

// functions

function createHandshakeResponse41({
	username,
	authResponse,
	database,
}) {
	const payloadParts = [
		createNumberBuffer((
			(database === null ? 0 : CLIENT_CONNECT_WITH_DB) |
			CLIENT_PROTOCOL_41 |
			CLIENT_TRANSACTIONS |
			CLIENT_DEPRECATE_EOF
		), 4), // clientCapabilitiesFlag
		createNumberBuffer(0, 4), // maxPacketSize
		createNumberBuffer(CHARACTER_SET_UTF8MB4, 1),
		Buffer.alloc(23), // filler
		Buffer.from(username, 'utf8'),
		createNumberBuffer(0, 1), // zero terminated
		createNumberBuffer(authResponse.byteLength, 1), // length encoded
		authResponse,
	];
	if(database !== null) {
		payloadParts.push(
			Buffer.from(database, 'utf8'),
			createNumberBuffer(0, 1), // zero terminated
		);
	}
	return Buffer.concat(payloadParts);
}
