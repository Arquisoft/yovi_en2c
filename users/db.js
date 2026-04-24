const mongoose = require('mongoose');

// Append _test suffix to the database name when running in test environment.
// This ensures the test suite never reads from or writes to the production database.
// Uses regex instead of URL() because multi-host MongoDB URIs
// (host1:port,host2:port,host3:port) are not valid URLs.
function buildConnectionUri(uri) {
    const resolvedUri = uri ?? process.env.MONGODB_URI;

    if (!resolvedUri) {
        console.error('MongoDB URL not found in variables');
        process.exit(1);
        return;
    }

    if (process.env.NODE_ENV !== 'test') return resolvedUri;

    if (/\/[^/?]+\?/.test(resolvedUri)) {
        return resolvedUri.replace(/\/([^/?]+)\?/, '/$1_test?');
    }

    if (/\/[^/?]+$/.test(resolvedUri)) {
        return resolvedUri.replace(/\/([^/?]+)$/, '/$1_test');
    }

    return resolvedUri.replace(/\/$/, '') + '/usersdb_test';
}

const connectionUri = buildConnectionUri();

if (connectionUri) {
    mongoose.connect(connectionUri)
        .then(() => console.log('Conection to MongoDB : CORRECT '))
        .catch((error) => {
            console.error('Conection to MongoDB : ERROR ->');
            console.error(error);
            process.exit(1);
        });
}

module.exports = mongoose;
module.exports.buildConnectionUri = buildConnectionUri;