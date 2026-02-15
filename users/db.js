// db.js - Conexión a MongoDB Atlas
const mongoose = require('mongoose');
require('dotenv').config(); // <-- Carga las variables del archivo .env

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('MongoDB URL not found in variables');
    console.error('Check .env file ');
    process.exit(1); // Detiene el server
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('Conection to MongoDB : CORRECT '))
    .catch((error) => {
        console.error('Conection to MongoDB : ERROR ->');
        console.error(error);
        process.exit(1);
    });

module.exports = mongoose;