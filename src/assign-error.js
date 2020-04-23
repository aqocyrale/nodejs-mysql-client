'use strict';

// export

module.exports = assignError;

// functions

function assignError(error, assign) {
	if(assign === null) return null;
	error.message = assign.message;
	Object.defineProperty(error, 'message', { enumerable: false });
	for(const key in assign) {
		if(!Object.prototype.hasOwnProperty.call(assign, key)) continue;
		if(key === 'stack') continue;
		error[key] = assign[key];
	}
	return error;
}
