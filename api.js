const mysql = require('mysql');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 8001;

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'toy'
});

const storage = multer.diskStorage({
    destination: './uploads',
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        const extension = path.extname(file.originalname);
        const filename = `${timestamp}${extension}`;
        cb(null, filename);
    }
});

const upload = multer({ storage: storage });

app.use(bodyParser.urlencoded({ extended: false }));

app.get('/restaurant', (req, res) => {
    let baseQuery = 'SELECT * FROM restaurants';
    let queryParams = [];

    connection.query(baseQuery, queryParams, (error, results, fields) => {
        if (error) {
            console.error('Error executing query', error.stack);
            return res.status(500).send('Server error');
        }
        res.status(200).json(results);
    });
});

app.get('/restaurant/:id', (req, res) => {
    const { id } = req.params;

    const selectQuery = 'SELECT * FROM restaurants WHERE id = ?';
    const selectValues = [id];

    connection.query(selectQuery, selectValues, (error, results, fields) => {
        if (error) {
            console.error('Error executing query', error.stack);
            return res.status(500).send('Server error');
        }

        if (results.length === 0) {
            return res.status(404).send(`Restaurant with ID ${id} not found`);
        }

        res.status(200).json(results[0]);
    });
});

app.post('/restaurant', upload.single('Rpic'), (req, res) => {

    const { userId, restaurantName, tags, speciality, type, description, address, googleMapLink } = req.body;
    if (!userId || !restaurantName || !tags || !speciality || !type || !description || !address || !googleMapLink) {
        return res.status(400).send('All fields are required');
    }

    const Rpic = req.file ? req.file.filename : '';
    const insertQuery = 'INSERT INTO restaurants (userId, restaurantName, Rpic, tags, speciality, type, description, address, googleMapLink) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const insertValues = [userId, restaurantName, Rpic, tags, speciality, type, description, address, googleMapLink];

    connection.query(insertQuery, insertValues, (error, results, fields) => {
        if (error) {
            console.error('Error executing query', error.stack);
            return res.status(500).send('Server error');
        }
        res.status(201).send('Data inserted successfully');
    });
});

app.put('/restaurant/:id', upload.single('Rpic'), (req, res) => {
    const { id } = req.params;
    const { restaurantName, tags, speciality, type, description, address, googleMapLink } = req.body;
    const Rpic = req.file ? req.file.filename : '';

    if (!restaurantName || !tags || !speciality || !type || !description || !address || !googleMapLink) {
        return res.status(400).send('All fields are required');
    }

    const updateQuery = 'UPDATE restaurants SET restaurantName = ?, tags = ?, speciality = ?, type = ?, description = ?, address = ?, googleMapLink = ?, Rpic = ? WHERE id = ?';
    const updateValues = [restaurantName, tags, speciality, type, description, address, googleMapLink, Rpic, id];

    connection.query(updateQuery, updateValues, (error, results, fields) => {
        if (error) {
            console.error('Error executing query', error.stack);
            return res.status(500).send('Server error');
        }

        res.status(200).send(`Data with ID ${id} updated successfully`);
    });
});

app.delete('/restaurant/:id', (req, res) => {
    const { id } = req.params;

    const deleteQuery = 'DELETE FROM restaurants WHERE id = ?';
    const deleteValues = [id];

    connection.query(deleteQuery, deleteValues, (error, results, fields) => {
        if (error) {
            console.error('Error executing query', error.stack);
            return res.status(500).send('Server error');
        }

        res.status(200).send(`Data with ID ${id} deleted successfully`);
    });
});

app.options('/restaurant', (req, res) => {
    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(200).end();
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
