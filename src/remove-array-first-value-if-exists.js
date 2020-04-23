'use strict';

// export

module.exports = removeArrayFirstValueIfExists;

// functions

function removeArrayFirstValueIfExists(array, element) {
	const index = array.indexOf(element);
	if(index !== -1) {
		array.splice(index, 1);
	}
}
