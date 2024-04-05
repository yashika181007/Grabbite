const express = require('express');
const fs = require('fs');
const expressLayouts = require('express-ejs-layouts');
const mysql = require('mysql');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const session = require("express-session");
const MySQLStore = require('express-mysql-session')(session);
const cookieParser = require("cookie-parser");
const PORT = process.env.PORT || 3000;
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'toy'
});
const sessionStoreOptions = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'toy',
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 minutes
    expiration: 86400000 // 1 day
};

const sessionStore = new MySQLStore(sessionStoreOptions);
app.use(session({
    secret: 'yashi',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database');
});

const upload = multer({
    dest: './uploads',
    filename: function (req, file, cb) {
        const timestamp = Date.now();
        cb(null, timestamp + '-' + file.originalname);
    }
});


const homeRoutes = require('./routes/routes');
app.use('/', homeRoutes);

app.get('/layout', (req, res) => {
    const email = req.session.email;
    let messages;
    if (email) {
        messages = { message: `Welcome! Your email is: ${email}` };
    } else {
        messages = { error: 'Welcome! Please sign up or sign in.' };
    }
    res.render('layout', { messages });
});


app.post('/signup', (req, res) => {
    const { name, email, password, terms } = req.body;

    if (!terms) {
        const messages = encodeURIComponent(JSON.stringify({
            error: 'You must agree to the terms and conditions.',
        }));

        return res.redirect(`/signup?messages=${messages}`);
    }

    connection.query("SELECT * FROM signup WHERE email = ?", [email], (error, results, fields) => {
        if (error) {
            console.error('Error checking email existence:', error.message);
            return res.status(500).send('Internal Server Error');
        }

        if (results.length > 0) {
            const messages = encodeURIComponent(JSON.stringify({
                error: 'Email already exists.',
            }));

            return res.redirect(`/signup?messages=${messages}`);
        }

        const userData = { name, email, password, terms: 1 };
        connection.query("INSERT INTO signup SET ?", userData, (error, results, fields) => {
          
            res.redirect('/signin');
        });
    });
});


app.post('/signin', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).send('Email and password are required.');
    }
    connection.query("SELECT * FROM signup WHERE email = ? AND password = ?", [email, password], (error, results, fields) => {
        if (error) {
            console.error('Error querying database:', error.message);
            return res.status(500).send('Internal Server Error');
        }
        if (results.length === 0) {
            const messages = encodeURIComponent(JSON.stringify({
                error: 'Invalid email or password.',
            }));
            return res.redirect(`/signin?messages=${messages}`);
        }
        req.session.email = email;
        res.redirect('/profile');
    });
});


app.post('/profile', upload.single('ppic'), (req, res) => {
    const { fname, lname, email, web, hobbies, about, phone, address, city, state, dob, gender } = req.body;
    console.log('Request Body:', req.body);

    const ppic = req.file ? req.file.filename : '';
    const profileData = {  fname, lname, email,ppic, web, hobbies, about, phone, address, city, state, dob, gender };
    console.log('Profile Data:', profileData);
    connection.query("SELECT * FROM Profile_details WHERE email = ? AND phone = ?", [email, phone], (error, results) => {
        if (results.length > 0) {
            connection.query("UPDATE Profile_details SET ? WHERE email = ? AND phone = ?", [profileData, email, phone], (error) => {
                if (error) {
                    console.error('Error updating data:', error.message);
                    return res.status(500).send('Internal Server Error');
                }
                console.log('Profile updated successfully.');
                res.redirect('/view_profile');
            });
        } else {
            connection.query("INSERT INTO Profile_details SET ?", profileData, (error, results) => {
                if (error) {
                    console.error('Error inserting data:', error.message);
                    return res.status(500).send('Internal Server Error');
                }
                console.log('New profile inserted successfully');
                res.redirect('/view_profile');
            });
        }
    });
});

app.get('/view_profile', (req, res) => {
    const view_profile = (req, res, next, results) => {
    return res.render('view_profile', { results, layout: false });
};
    connection.query("SELECT * FROM Profile_details", (error, results) => {
        if (error) {
            console.error('Error querying database:', error.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('SQL Query:', "SELECT * FROM Profile_details");
        console.log('Query results:', results);
        return view_profile(req, res, null, results);
    });
});


app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.redirect('/signup'); 
    });
});


const assetsPath = path.join(__dirname, 'assets');
app.use('/assets', express.static(assetsPath));

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
