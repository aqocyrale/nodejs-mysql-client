'use strict';

// export

module.exports = createNumberBuffer;

// functions

function createNumberBuffer(number, byteCount) {
	const buffer = Buffer.allocUnsafe(byteCount);
	buffer.writeUIntLE(number, 0, byteCount);
	return buffer;
}
