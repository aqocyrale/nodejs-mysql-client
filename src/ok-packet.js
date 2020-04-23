'use strict';

// export

module.exports = OkPacket;

// functions

function OkPacket({
	affectedRows = 0,
	lastInsertId = 0,
	statusFlags = 0,
	warningCount = 0,
} = {}) {
	Object.assign(this, {
		affectedRows,
		lastInsertId,
		warningCount,
		isInTransaction: (statusFlags & 1) !== 0,
		isAutoCommitOn: (statusFlags & 2) !== 0,
		// SERVER_MORE_RESULTS_EXISTS: (statusFlags & 8) !== 0,
		// SERVER_QUERY_NO_GOOD_INDEX_USED: (statusFlags & 16) !== 0,
		// SERVER_QUERY_NO_INDEX_USED: (statusFlags & 32) !== 0,
		// SERVER_STATUS_CURSOR_EXISTS: (statusFlags & 64) !== 0,
		// SERVER_STATUS_LAST_ROW_SENT: (statusFlags & 128) !== 0,
		wasDatabaseDropped: (statusFlags & 256) !== 0,
		isBackslashEscapeDisabled: (statusFlags & 512) !== 0,
		// SERVER_STATUS_METADATA_CHANGED: (statusFlags & 1024) !== 0,
		wasQuerySlow: (statusFlags & 2048) !== 0,
		// SERVER_PS_OUT_PARAMS: (statusFlags & 4096) !== 0,
		// SERVER_STATUS_IN_TRANS_READONLY: (statusFlags & 8192) !== 0,
		hasSessionStateChanged: (statusFlags & 16384) !== 0,
	});
}
