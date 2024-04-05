const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');
const expressLayouts = require('express-ejs-layouts');
const mysql = require('mysql');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();
const session = require("express-session");
const MySQLStore = require('express-mysql-session')(session);
const cookieParser = require("cookie-parser");
const PORT = process.env.PORT || 5000;
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('uploads'));

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
    expiration: 21600000 // 6 hours
};


const sessionStore = new MySQLStore(sessionStoreOptions);
app.use(session({
    secret: 'yashi',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 6 * 60 * 60 * 1000 } // 6 hours in milliseconds
}));


connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL database:', err);
        process.exit(1);
    }
    console.log('Connected to MySQL database');
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
    const { fname, email, password, terms } = req.body;

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

        const userData = { fname, email, password, terms: 1 };
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
        const userId = results[0].id;
        req.session.userId = userId;
        req.session.email = email;
        res.redirect('/layout');
    });
});


app.post('/addrestaurant', upload.single('Rpic'), (req, res) => {
    const { restaurantName, tags, speciality, type, description, address, googleMapLink } = req.body;
    console.log('Request Body:', req.body);
    const userId = req.session.userId;
    if (!userId) {
        console.error('User ID is empty.');
        return res.status(400).send('User ID is required.');
    }
    const Rpic = req.file ? req.file.filename : '';
    const profileData = { userId, Rpic, restaurantName, tags: tags.join(', '), speciality:speciality.join(', '), type:type.join(', '), description, address, googleMapLink };
    console.log('Profile Data:', profileData);

    connection.query("INSERT INTO restaurants SET ?", profileData, (error) => {
        if (error) {
            console.error('Error updating data:', error.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Profile updated successfully.');
        res.redirect('/view_restaurants');
    });
});

app.get('/update_profile', (req, res) => {
    const userId = req.session.userId; 
    if (!userId) {
        return res.redirect('/signin'); 
    }

    const update_profile = (req, res, next, results) => {
        return res.render('update_profile', { results, layout: false });
    };

    const id = req.query.id; 
    connection.query("SELECT * FROM restaurants WHERE id = ? AND userId = ?", [id, userId], (error, results) => {
        if (error) {
            console.error('Error querying database:', error.message);
            return res.status(500).send('Internal Server Error');
        }
        console.log('Query results:', results);
        if (results.length === 0) {
            return res.status(404).send('Record not found');
        }
        return update_profile(req, res, null, results);
    });
});

app.post('/update_profile', upload.single('Rpic'), (req, res) => {
    const { restaurantName, tags, speciality, type, description, address, googleMapLink } = req.body;
    const userId = req.session.userId;
    
    if (!userId) {
        console.error('User ID is empty.');
        return res.status(400).send('User ID is required.');
    }
    
    const Rpic = req.file ? req.file.filename : '';
    const profileData = { Rpic, restaurantName, tags, speciality, type, description, address, googleMapLink };

    connection.query("SELECT id FROM restaurants WHERE userId = ?", [userId], (error, results) => {
        if (error) {
            console.error('Error querying database:', error.message);
            return res.status(500).send('Internal Server Error');
        }
        
        const id = results[0]?.id;

        if (!id) {
            console.log('No existing data found.');
            return res.status(404).send('No existing data found.');
        }
        
        const updateQuery = "UPDATE restaurants SET ? WHERE id = ? AND userId = ?";
        
        connection.query(updateQuery, [profileData, id, userId], (updateError, updateResults) => {
            if (updateError) {
                console.error('Error updating data:', updateError.message);
                return res.status(500).send('Internal Server Error');
            }

            if (updateResults.affectedRows === 0) {
                console.log('No rows were updated. Check your query conditions.');
                return res.status(404).send('No rows were updated.');
            }
            
            console.log('Profile updated successfully.');
            res.redirect('/view_restaurants');
        });
    });
});

app.get('/delete', (req, res) => {
    const userId = req.session.userId;
    connection.query("SELECT id FROM restaurants WHERE userId = ?", [userId], (error, results) => {
        if (error) {
            console.error('Error querying database:', error.message);
            return res.status(500).send('Internal Server Error');
        }
        
        const id = results[0]?.id;

        if (!id) {
            console.log('No existing data found.');
            return res.status(404).send('No existing data found.');
        }
    connection.query("DELETE FROM restaurants WHERE id = ?", [id], (error, results) => {
        if (error) {
            console.error('Error deleting entry:', error.message);
            return res.status(500).send('Internal Server Error');
        }
        if (results.affectedRows === 0) {
            console.log('No entry found with the provided ID:', id);
            return res.status(404).send('No entry found with the provided ID.');
        }
        console.log('Entry deleted successfully.');
     
        res.redirect('/view_restaurants');
    });
});
});










app.get('/view_restaurants', (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/signin'); 
    }

    const view_restaurants = (req, res, next, results) => {
        return res.render('view_restaurants', { results, layout: false });
    };

    connection.query("SELECT * FROM restaurants WHERE userId = ?", [userId], (error, results) => {
        if (error) {
            console.error('Error querying database:', error.message);
            return res.status(500).send('Internal Server Error');
        }
       

        const id = results.length > 0 ? results[0].id : null;
        

        return view_restaurants(req, res, null, results);
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
