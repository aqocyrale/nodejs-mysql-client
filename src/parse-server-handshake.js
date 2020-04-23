'use strict';

// static

const CLIENT_PLUGIN_AUTH = 2 ** 19;

// export

module.exports = parseServerHandshake;

// functions

function parseServerHandshake(payload) {
	const protocolVersion = payload.readUIntLE(0, 1);
	switch(protocolVersion) {
		case 9:
			return parseServerHandshakeV9(payload);
		case 10:
			return parseServerHandshakeV10(payload);
		default:
			throw Object.assign(Error('unsupported server handshake version'), {
				code: 'ERR_SERVER_HANDSHAKE_PROTOCOL_VERSION',
				supportedVersions: [ 9, 10 ],
				versionReceived: protocolVersion,
			});
	}
}

function parseServerHandshakeV9(payload) {
	let minBufferByteLength = 1 + 4;
	
	let offset = 1;
	let indexOfZero = payload.indexOf(0, offset);
	if(indexOfZero === -1) throw Object.assign(Error('handshake missing server version string'), {
		code: 'ERR_SERVER_VERSION_STRING',
	});
	
	minBufferByteLength += indexOfZero + 1 - offset;
	if(payload.byteLength < minBufferByteLength) throw Object.assign(Error('bad packet size'), {
		code: 'ERR_INCONSISTENT_BUFFER_LENGTH',
	});
	
	const serverVersion = payload.slice(offset, indexOfZero).toString('ascii');
	offset = indexOfZero + 1;
	
	const connectionId = payload.readUIntLE(offset, 4);
	offset += 4;
	
	indexOfZero = payload.indexOf(0, offset);
	if(indexOfZero === -1) throw Object.assign(Error('handshake missing auth plugin data'), {
		code: 'ERR_NO_AUTH_PLUGIN_DATA',
	});
	
	const authPluginData = payload.slice(offset, indexOfZero);
	
	return {
		version: 9,
		serverVersion,
		connectionId,
		authPluginData,
	};
}

function parseServerHandshakeV10(payload) {
	let minBufferByteLength = 1 + 4 + 8 + 1 + 2 + 1 + 2 + 2 + 1 + 10;
	
	let offset = 1;
	let indexOfZero = payload.indexOf(0, offset);
	if(indexOfZero === -1) throw Object.assign(Error('handshake missing server version string'), {
		code: 'ERR_SERVER_VERSION_STRING',
	});
	
	minBufferByteLength += indexOfZero + 1 - offset;
	if(payload.byteLength < minBufferByteLength) throw Object.assign(Error('bad packet size'), {
		code: 'ERR_INCONSISTENT_BUFFER_LENGTH',
	});
	
	const serverVersion = payload.slice(offset, indexOfZero).toString('ascii');
	offset = indexOfZero + 1;
	
	const connectionId = payload.readUIntLE(offset, 4);
	offset += 4;
	
	const authPluginDataPart1 = payload.slice(offset, offset + 8);
	offset += 8;
	
	// always 1 0x00 byte
	offset += 1;
	
	const capabilityFlagsBuffer = Buffer.allocUnsafe(4);
	capabilityFlagsBuffer[0] = payload[offset + 0];
	capabilityFlagsBuffer[1] = payload[offset + 1];
	offset += 2;
	
	const characterSetId = payload.readUIntLE(offset, 1);
	offset += 1;
	
	const serverStatusFlags = payload.readUIntLE(offset, 2);
	offset += 2;
	
	capabilityFlagsBuffer[2] = payload[offset + 0];
	capabilityFlagsBuffer[3] = payload[offset + 1];
	offset += 2;
	const capabilityFlags = capabilityFlagsBuffer.readUIntLE(0, 4);
	
	const isClientPluginAuthSet = (capabilityFlags & CLIENT_PLUGIN_AUTH) !== 0;
	
	if(!isClientPluginAuthSet) throw Object.assign(Error('server did not set auth plugin'), {
		code: 'ERR_AUTH_PLUGIN_NOT_ENABLED',
	});
	
	const authPluginDataLength = isClientPluginAuthSet ? payload.readUIntLE(offset, 1) : 0;
	offset += 1;
	
	// always 10 0x00 bytes
	offset += 10;
	
	const authPluginDataPart2Length = Math.max(13, authPluginDataLength - 8);
	const authPluginDataPart2 = payload.slice(offset, offset + authPluginDataPart2Length);
	offset += authPluginDataPart2Length;
	
	minBufferByteLength += authPluginDataPart2Length;
	if(payload.byteLength < minBufferByteLength) throw Object.assign(Error('bad packet size'), {
		code: 'ERR_INCONSISTENT_BUFFER_LENGTH',
	});
	
	const authPluginData = Buffer.concat([ authPluginDataPart1, authPluginDataPart2 ]);
	
	let authPluginName = '';
	if(isClientPluginAuthSet) {
		indexOfZero = payload.indexOf(0, offset);
		if(indexOfZero === -1) throw Object.assign(Error('handshake missing auth plugin name'), {
			code: 'ERR_NO_AUTH_PLUGIN_NAME',
		});
		authPluginName = payload.slice(offset, indexOfZero).toString('ascii');
		offset = indexOfZero + 1;
	}
	
	return {
		version: 10,
		serverVersion,
		connectionId,
		characterSetId,
		serverStatusFlags,
		capabilityFlags,
		authPluginData,
		authPluginName,
	};
}
