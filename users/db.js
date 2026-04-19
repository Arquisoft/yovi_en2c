// db.js - MongoDB connection with environment-based database isolation
const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MongoDB URL not found in variables');
    console.error('Check .env file ');
    process.exit(1);
}

// Append _test suffix to the database name when running in test environment.
// This ensures the test suite never reads from or writes to the production database.
// Uses regex instead of URL() because multi-host MongoDB URIs
// (host1:port,host2:port,host3:port) are not valid URLs.
function buildConnectionUri(uri) {
    if (process.env.NODE_ENV !== 'test') return uri;

    // Matches the database name between the last / and the ? (query string)
    // e.g. .../usersdb?ssl=true  →  .../usersdb_test?ssl=true
    if (/\/[^/?]+\?/.test(uri)) {
        return uri.replace(/\/([^/?]+)\?/, '/$1_test?');
    }

    // URI ends with /dbname (no query string)
    if (/\/[^/?]+$/.test(uri)) {
        return uri.replace(/\/([^/?]+)$/, '/$1_test');
    }

    // No database name found — append default
    return uri.replace(/\/$/, '') + '/usersdb_test';
}

const connectionUri = buildConnectionUri(MONGODB_URI);

mongoose.connect(connectionUri)
    .then(() => console.log('Conection to MongoDB : CORRECT '))
    .catch((error) => {
        console.error('Conection to MongoDB : ERROR ->');
        console.error(error);
        process.exit(1);
    });

module.exports = mongoose;