'use strict';

// import

const Crypto = require('crypto');

// export

module.exports = createMySQLAuthResponse;

// functions

function createMySQLAuthResponse({
	authPluginName,
	authPluginData,
	password,
}) {
	switch(authPluginName) {
		case 'mysql_native_password':
			return createMySQLNativePasswordAuthResponse(password, authPluginData.slice(0, 20));
		default:
			throw Object.assign(Error('unsupported auth plugin name'), {
				code: 'ERR_AUTH_PLUGIN',
				received: authPluginName,
				supported: [ 'mysql_native_password' ],
			});
	}
}

function createMySQLNativePasswordAuthResponse(password, scramble) {
	const sha1Password = sha1Hash(Buffer.from(password, 'utf8').toString('binary'));
	return xor(
		Buffer.from(sha1Password, 'binary'),
		Buffer.from(sha1Hash(scramble.toString('binary') + sha1Hash(sha1Password)), 'binary'),
	);
}

function xor(buffer1, buffer2) {
	const byteLength = buffer1.byteLength;
	const result = Buffer.allocUnsafe(byteLength);
	for(let i = 0; i < byteLength; ++i) {
		result[i] = buffer1[i] ^ buffer2[i];
	}
	return result;
}

function sha1Hash(string) {
	return Crypto.createHash('sha1').update(string, 'binary').digest('binary');
}
