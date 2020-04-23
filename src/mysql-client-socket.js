'use strict';

// import

const Net = require('net');
const createMySQLAuthResponse = require('./create-mysql-auth-response');
const createHandshakeResponse41 = require('./create-handshake-response-41');
const parseServerHandshake = require('./parse-server-handshake');
const assignMySQLError = require('./assign-mysql-error');
const createNumberBuffer = require('./create-number-buffer');
const ComQueryResponse = require('./com-query-response');

// static

const MAX_PAYLOAD_LENGTH = 2 ** 24 - 1;
const COM_QUERY_FLAG_BUFFER = createNumberBuffer(3, 1);
const MAX_ERROR_SQL_TEXT_LENGTH = 1024;

// export

module.exports = MySQLClientSocket;

// functions

function MySQLClientSocket({
	host,
	port,
	username,
	password,
	database,
	onHandshake,
	onDisconnect,
	decodeRecordValue,
}) {
	const This = this;
	
	// state.connection
	
	const socket = new Net.Socket();
	let connectionError = Error('not connected');
	let pendingCallback = onHandshake;
	
	// state.read
	
	const unhandledReadBuffers = [];
	let unhandledReadLength = 0;
	let incomingPayloadLength = -1;
	let incomingPacketSize = -1;
	let lastSequenceId = -1;
	const payloadBuffers = [];
	let onMySQLPacket = onServerHandshake;
	let comQueryResponse = null;
	let lastSQLText = '';
	
	// run
	
	socket.on('error', error => resolve(error));
	socket.on('data', onData);
	socket.on('close', onClose);
	socket.connect(port, host, () => {
		connectionError = Error('handshake not complete');
	});
	
	// public
	
	Object.assign(this, {
		connectionId: null,
		comQuery,
		disconnect,
	});
	
	// functions.public
	
	function comQuery(sqlText, callback) {
		lastSQLText = sqlText;
		pendingCallback = callback;
		comQueryResponse = new ComQueryResponse(decodeRecordValue, resolve);
		onMySQLPacket = onComQueryReply;
		lastSequenceId = -1;
		sendPacket(Buffer.concat([
			COM_QUERY_FLAG_BUFFER,
			Buffer.from(sqlText, 'utf8'),
		]));
	}
	
	function disconnect() {
		socket.destroy();
		callOnDisconnect();
	}
	
	// functions.private
	
	function mergeUnhandledReadBuffers() {
		if(unhandledReadBuffers.length > 1) {
			const buffer = Buffer.concat(unhandledReadBuffers);
			unhandledReadBuffers.length = 0;
			unhandledReadBuffers.push(buffer);
		}
	}
	
	function onData(buffer) {
		unhandledReadBuffers.push(buffer);
		unhandledReadLength += buffer.byteLength;
		handleReadData();
	}
	
	function sendPacket(payload) {
		let offsetStart = 0;
		let frameSize = MAX_PAYLOAD_LENGTH;
		do {
			frameSize = Math.min(payload.byteLength - offsetStart, MAX_PAYLOAD_LENGTH);
			sendPacketChunk(payload.slice(offsetStart, offsetStart + frameSize));
			offsetStart += frameSize;
		} while(frameSize === MAX_PAYLOAD_LENGTH);
	}
	
	function sendPacketChunk(chunk) {
		lastSequenceId = getNextSequenceId();
		socket.write(Buffer.concat([
			createNumberBuffer(chunk.byteLength, 3),
			createNumberBuffer(lastSequenceId, 1),
			chunk,
		]));
	}
	
	function handleReadData() {
		if(unhandledReadLength < 4) return; // wait for more data for header
		
		if(unhandledReadBuffers[0].byteLength < 4) { // merge buffers to read header
			mergeUnhandledReadBuffers();
		}
		
		if(incomingPayloadLength === -1) {
			
			// cache payload size and packet size for this packet
			
			incomingPayloadLength = unhandledReadBuffers[0].readUIntLE(0, 3);
			incomingPacketSize = incomingPayloadLength + 4;
			
			// validate and update sequenceId
			
			const receivedSequenceId = unhandledReadBuffers[0].readUIntLE(3, 1);
			const expectedSequenceId = getNextSequenceId();
			if(receivedSequenceId !== expectedSequenceId) {
				return quitWithError(Error('invalid server sequenceId'), {
					code: 'ERR_SERVER_ERROR',
					type: 'SEQUENCE_ID',
					expectedSequenceId,
					receivedSequenceId,
				});
			}
			lastSequenceId = receivedSequenceId;
		}
		
		if(unhandledReadLength < incomingPacketSize) return; // wait for more data for payload
		
		mergeUnhandledReadBuffers(); // merge buffers to read payload
		payloadBuffers.push(unhandledReadBuffers[0].slice(4, incomingPacketSize));
		unhandledReadBuffers[0] = unhandledReadBuffers[0].slice(incomingPacketSize);
		if(unhandledReadBuffers[0].byteLength === 0) {
			unhandledReadBuffers.length = 0;
		}
		unhandledReadLength -= incomingPacketSize;
		
		if(incomingPayloadLength !== MAX_PAYLOAD_LENGTH) {
			const payload = payloadBuffers.length === 1
				? payloadBuffers[0]
				: Buffer.concat(payloadBuffers);
			payloadBuffers.length = 0;
			onMySQLPacket(payload);
			incomingPayloadLength = -1;
			handleReadData();
		} else {
			incomingPayloadLength = -1;
		}
	}
	
	function onClose() {
		callOnDisconnect();
		resolve(Error('connection closed'));
	}
	
	function callOnDisconnect() {
		if(onDisconnect !== null) {
			const callback = onDisconnect;
			onDisconnect = null;
			callback();
		}
	}
	
	function onServerHandshake(payload) {
		let serverHandshake;
		try {
			serverHandshake = parseServerHandshake(payload);
		} catch(error) {
			return quitWithError(error);
		}
		
		if(serverHandshake.version !== 10) {
			return quitWithError(Error('unsupported handshake version'), {
				code: 'ERR_UNSUPPORTED_HANDSHAKE_VERSION',
				supportedVersions: [ 10 ],
				receivedVersion: serverHandshake.version,
			});
		}
		
		let authResponse = null;
		try {
			authResponse = createMySQLAuthResponse({
				authPluginName: serverHandshake.authPluginName,
				authPluginData: serverHandshake.authPluginData,
				password,
			});
		} catch(error) {
			return quitWithError(error);
		}
		
		This.connectionId = serverHandshake.connectionId;
		
		// send client handshake response, only support version 41
		
		onMySQLPacket = onHandshakeResponseReply;
		sendPacket(createHandshakeResponse41({
			username,
			authResponse,
			database,
		}));
	}
	
	function onHandshakeResponseReply(payload) {
		if(payload.byteLength < 1) {
			return quitWithError(Error('invalid handshake response reply'), {
				code: 'ERR_INVALID_SERVER_REPLY',
				reason: 'NO_HEADER',
			});
		}
		
		switch(payload.readUIntLE(0, 1)) {
			case 0xFF: // Error
				return onHandshakeResponseReplyError(payload);
			case 0x00: // Ok
			case 0xFE: // EOF(Ok)
				return onHandshakeResponseReplyOk(payload);
			default:
				return quitWithError(Error('invalid handshake response reply'), {
					code: 'ERR_INVALID_SERVER_REPLY',
					reason: 'BAD_HEADER',
				});
		}
	}
	
	function onHandshakeResponseReplyError(payload) {
		return quitWithError(assignMySQLError(Error(), payload));
	}
	
	function onHandshakeResponseReplyOk(payload) {
		resolve(null);
	}
	
	function onComQueryReply(payload) {
		comQueryResponse.pushPacket(payload);
	}
	
	function getNextSequenceId() {
		return (lastSequenceId + 1) % 256;
	}
	
	function quitWithError(error, assign = {}) {
		resetReadState();
		connectionError = Object.assign(error, assign);
		disconnect();
		resolve(connectionError);
	}
	
	function resetReadState() {
		unhandledReadBuffers.length = 0;
		unhandledReadLength = 0;
		incomingPayloadLength = -1;
		incomingPacketSize = -1;
		lastSequenceId = -1;
		payloadBuffers.length = 0;
	}
	
	function resolve(error, result) {
		if(pendingCallback !== null) {
			const callback = pendingCallback;
			pendingCallback = null;
			if(error && lastSQLText !== '') {
				if(lastSQLText.length > MAX_ERROR_SQL_TEXT_LENGTH) {
					const half = Math.floor(MAX_ERROR_SQL_TEXT_LENGTH / 2);
					error.sqlText = lastSQLText.slice(0, half) + ' ... ' + lastSQLText.slice(-half);
				} else {
					error.sqlText = lastSQLText;
				}
				lastSQLText = '';
			}
			callback(error, result);
		}
	}
}
