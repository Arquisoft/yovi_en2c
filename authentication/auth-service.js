const express = require('express');
require('dotenv').config();
require('./db');

const { register, login } = require('./authentication');

const app = express();

app.use(express.json());


// ROUTES

app.post('/register', register);

app.post('/login', login);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(`Auth service running on port ${PORT}`);
});
