// Simple error helper for consistent API error responses.
// Usage: throw new ApiError(404, 'Device not found');

class ApiError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}

module.exports = { ApiError };
