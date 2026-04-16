// auth-service does NOT connect to a database directly.
// All user storage and credential verification is handled by users-service.
// This file is intentionally empty — kept so that any accidental require('./db')
// does not crash the process.