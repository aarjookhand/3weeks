const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');
const multer = require('multer');
const puppeteer = require('puppeteer');

const app = express();
const port = 1111;


// Set up body-parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.urlencoded({ extended: true }));

// Configure MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'projectdb',
});


// Configure session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));


// Set up the Express middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from the same directory as app.js
app.use(express.static(__dirname));

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'pages')); 



// Route to serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route for serving the login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

const nodemailer = require('nodemailer'); // Import nodemailer for sending emails

// Define the generateOTP function
function generateOTP() {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < 6; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

// Route for handling the login form submission
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Perform database query to check credentials
  const query = 'SELECT * FROM login WHERE username = ? AND password = ?';
  connection.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Error checking credentials:', err);
      res.status(500).send('Error checking credentials');
    } else {
      if (results.length > 0) {
        req.session.loggedInUser = {
          id: results[0].id,
          username: results[0].username,
          role: results[0].role
          // Add other user properties as needed
        };

        if (req.session.loggedInUser.role === 'admin') {
          // Generate OTP and send it to the user's email
          const otp = generateOTP(); // Implement your OTP generation logic here
        
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'festevent123@gmail.com',
              pass: 'pxkvjhmrgkfwlphc'
            }
          });
        
          const mailOptions = {
            from: 'festevent123@gmail.com',
            to: 'aarjookhand@gmail.com', // Assuming you have an 'email' column in your database
            subject: 'Login OTP',
            text: `Your OTP: ${otp}`
          };
        
          transporter.sendMail(mailOptions, (emailErr, info) => {
            if (emailErr) {
              console.error('Error sending OTP:', emailErr);
              res.status(500).send('Error sending OTP');
            } else {
              // Store OTP in the session
              req.session.otp = otp;
              res.redirect('/otp'); // Redirect to OTP verification page
            }
          });
        } else if (req.session.loggedInUser.role === 'support') {
          // Generate OTP and send it to the user's email (username is an email)
          const otp = generateOTP();
        
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: 'festevent123@gmail.com',
              pass: 'pxkvjhmrgkfwlphc'
            }
          });
        
          const mailOptions = {
            from: 'festevent123@gmail.com',
            to: username, // Support user's email (username is an email)
            subject: 'Login OTP',
            text: `Your OTP: ${otp}`
          };
        
          transporter.sendMail(mailOptions, (emailErr, info) => {
            if (emailErr) {
              console.error('Error sending OTP:', emailErr);
              res.status(500).send('Error sending OTP');
            } else {
              // Store OTP in the session
              req.session.otp = otp;
              res.redirect('/otp'); // Redirect to OTP verification page
            }
          });
        } else {
          // Non-admin, non-support users
          res.redirect('/home');
        }
      } else {
        // Invalid credentials
        res.send('Invalid username or password.');
      }
    }
  });
});


// Route for serving the OTP verification page
app.get('/otp', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'otp.html'));
});



// Route for handling OTP verification
app.post('/verify-otp', (req, res) => {
  const { otp } = req.body;
  if (otp === req.session.otp) {
    // OTP is correct, proceed with login
    if (req.session.loggedInUser.role === 'admin') {
      res.redirect('/admin');
    } else if (req.session.loggedInUser.role === 'support') {
      res.redirect('/clients');
    } else {
      res.redirect('/home');
    }
  } else {
    // Invalid OTP
    res.send('Invalid OTP.');
  }
});


// Middleware to check if the user is logged in
const checkAuth = (req, res, next) => {
  if (req.session.loggedInUser) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Route for serving the home page based on user's role
app.get('/home', checkAuth, (req, res) => {
  const role = req.session.loggedInUser;
  if (role === 'admin') {
    // Render the admin.ejs template
    connection.query('SELECT * FROM supply', (err, rows) => {
      if (err) {
        console.error('Error querying supply table: ', err);
        return;
      }
      // Render the admin.ejs template with the supply data
      res.render('admin', { supplies: rows });
    });
  } else if (role === 'support') {
    res.redirect('client'); // Redirect to the support home page
  } else {
    res.send('Invalid user role.');
  }
});


app.get('/admin', (req, res) => {
 
  // Query the supply table
  connection.query('SELECT * FROM supply', (err, rows) => {
    if (err) {
      console.error('Error querying supply table: ', err);
      return;
    }
    // Render the admin.ejs template with the supply data and supplyId
    const supplyId = req.params.supplyId; // Extract supplyId from the request parameters
    res.render('admin', { supplies: rows, currentSupplyId: supplyId });
    
  });
});




app.post('/addSupply', (req, res) => {
  console.log('Form data received:', req.body); 
  const { name, description, category, sub_category, country, region, city, quantity, rate } = req.body;

  // Perform validation here
  if (!name || !description || !category || !sub_category || !country || !region || !city || !quantity || !rate) {
    return res.status(400).send('All fields are required.');
  }

  // Proceed with the database insertion
  const query = 'INSERT INTO supply (name, description, category, sub_category, country, region, city, quantity, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const values = [name, description, category, sub_category, country, region, city, quantity, rate];

  connection.query(query, values, (err, result) => {
    if (err) {
      console.error('Error adding supply:', err);
      res.status(500).send('Error adding supply');
    } else {
      // Get the ID of the newly added supply
      
      const supplyId = result.insertId;
     
      res.redirect(`/uploadImages/${supplyId}`);

      
    }
  });
});



// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Route to render the image upload form
app.get('/uploadImages/:supplyId', (req, res) => { // Fix the parameter name here
  const supplyId = req.params.supplyId;
  res.render('image', { supplyId });
});


app.post('/uploadImages/:supplyId', upload.array('image', 10), (req, res) => {
  const supplyId = req.params.supplyId; // Retrieve supplyId from request parameter
  const imageBuffers = req.files.map(file => file.buffer); // Retrieve an array of image buffers

  console.log('supplyId:', supplyId);
  console.log('Number of images:', imageBuffers.length);

  // Perform any necessary image processing or validation here

  // Proceed with the database insertion for each image
  const query = 'INSERT INTO supply_images (supply_id, image_data) VALUES ?';
  const values = imageBuffers.map(imageBuffer => [supplyId, imageBuffer]);

  

  connection.query(query, [values], (err, result) => {
    if (err) {
      console.error('Error adding images:', err);
      res.status(500).send('Error adding images');
    } else {
      console.log('Images uploaded');
      res.redirect('/admin'); // Redirect back to the admin page after successful image upload
    }
  });
});







app.get('/images/:supplyId', (req, res) => {
  const supplyId = req.params.supplyId;

  // Query the supply_images table to retrieve images associated with the supply
  const query = 'SELECT * FROM supply_images WHERE supply_id = ?';
  connection.query(query, [supplyId], (err, rows) => {
    if (err) {
      console.error('Error querying images:', err);
      res.status(500).send('Error querying images');
    } else {
      const images = rows; // Assign the retrieved rows to the 'images' variable
      
      console.log('Fetched images:', images);
      
      res.render('image', { images, supplyId });
    }
  });
});






// Route for updating images (adding new images)
app.post('/updateImage/:supplyId', upload.array('images', 10), (req, res) => {
  const supplyId = req.params.supplyId;
  const imageBuffers = req.files.map(file => file.buffer);

  console.log('supplyId:', supplyId);
  console.log('Number of new images:', imageBuffers.length);

  // Perform any necessary image processing or validation here

  // Proceed with the database insertion for each new image
  const insertQuery = 'INSERT INTO supply_images (supply_id, image_data) VALUES ?';
  const insertValues = imageBuffers.map(imageBuffer => [supplyId, imageBuffer]);

  connection.query(insertQuery, [insertValues], (err, insertResult) => {
      if (err) {
          console.error('Error adding new images:', err);
          res.status(500).send('Error adding new images');
      } else {
          console.log('New images added');
          res.redirect(`/admin`); // Redirect back to the edit image page after adding new images
      }
  });
});

// Route for deleting a specific image
app.post('/updateImage/:imageId/delete', (req, res) => {
  const imageId = req.params.imageId;

  // Delete the image from the database based on the imageId
  const deleteQuery = 'DELETE FROM supply_images WHERE id = ?';
  connection.query(deleteQuery, [imageId], (err, deleteResult) => {
      if (err) {
          console.error('Error deleting image:', err);
          res.status(500).send('Error deleting image');
      } else {
          console.log('Image deleted');
          res.redirect(`/admin`); // Redirect back to the edit image page after deleting the image
      }
  });
});



// Route for handling the edit form submission
app.post('/edit/:id',  (req, res) => {
  const supplyId = req.params.id;
  const { name, description, category, sub_category, country, region, city, quantity, rate } = req.body;

  // Update the corresponding record in the supply table
  const query = 'UPDATE supply SET name = ?, description = ?, category = ?, sub_category = ?, country = ?, region = ?, city = ?, quantity = ?, rate = ?  WHERE id = ?';
  const queryParams = [name, description, category, sub_category, country, region, city, quantity, rate, supplyId];

  connection.query(query, queryParams, (err, result) => {
    if (err) {
      console.error('Error updating supply:', err);
      res.status(500).send('Error updating supply');
    } else {
       // Redirect to the image upload form for the newly added supply
       res.redirect(`/admin`);
    }
  });
});

// Route for rendering the edit form
app.get('/edit/:id', (req, res) => {
  const supplyId = req.params.id;

  // Fetch the specific supply item from the database
  const query = 'SELECT * FROM supply WHERE id = ?';
  connection.query(query, [supplyId], (err, result) => {
    if (err) {
      console.error('Error fetching supply:', err);
      res.status(500).send('Error fetching supply');
    } else {
      const supply = result[0];
      res.render('adminedit', { supply }); 
    }
  });
});


// Route for handling the delete request
app.get('/delete/:id', (req, res) => {
  const supplyId = req.params.id;

  // Delete the supply from the database
  const query = 'DELETE FROM supply WHERE id = ?';
  connection.query(query, [supplyId], (err, result) => {
    if (err) {
      console.error('Error deleting supply:', err);
      res.status(500).send('Error deleting supply');
    } else {
      res.redirect('/admin'); // Redirect back to the admin page after successful deletion
    }
  });
});


// Route for handling the search
app.get('/search', (req, res) => {
  const searchInput = req.query.searchInput;

  // Query the supply table with the search criteria
  const query = 'SELECT * FROM supply WHERE name LIKE ? OR category LIKE ? OR sub_category LIKE ? OR description LIKE ?';
  const searchPattern = `%${searchInput}%`;
  connection.query(query, [searchPattern, searchPattern, searchPattern, searchPattern], (err, rows) => {
    if (err) {
      console.error('Error searching supplies:', err);
      res.status(500).send('Error searching supplies');
    } else {
      // Render the admin.ejs template with the search results
      res.render('admin', { supplies: rows });
    }
  });
});



// Route for handling the client registration form submission
app.post('/registerClient', (req, res) => {
  const { firstName, lastName, address, email, contactNumber } = req.body;

  // Insert the new client into the database
  const query = 'INSERT INTO clients (firstname, lastname, address, email, contact_number) VALUES (?, ?, ?, ?, ?)';
  const values = [firstName, lastName, address, email, contactNumber];

  connection.query(query, values, (err, result) => {
    if (err) {
      console.error('Error registering client:', err);
      res.status(500).send('Error registering client');
    } else {
      res.redirect('/clients'); // Redirect back to the registered clients page after successful registration
    }
  });
});


// Route for rendering the client page with search functionality
app.get('/clients', (req, res) => {
  const searchInput = req.query.searchInput || ''; // Default to an empty string if searchInput is not provided

  let query = 'SELECT id, firstname, lastname, address, email, contact_number FROM clients';
  const values = [];

  if (searchInput) {
    // If search input is provided, add the WHERE clause to filter the results
    query += ' WHERE firstname LIKE ? OR lastname LIKE ? OR email LIKE ? OR contact_number LIKE ?';
    const searchPattern = `%${searchInput}%`;
    values.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  connection.query(query, values, (err, results) => {
    if (err) {
      console.error('Error retrieving client data:', err);
      res.status(500).send('Error retrieving client data');
    } else {
      // Render the client.ejs file with the client data and search input
      res.render('client', { clients: results, searchInput }); // Pass searchInput to the template
    }
  });
});

// Route for rendering the client history page
app.get('/client/history/:clientId', (req, res) => {
  const clientId = req.params.clientId;

  // Query the database to retrieve the client details
  const query = 'SELECT * FROM clients WHERE id = ?';
  connection.query(query, [clientId], (err, results) => {
    if (err) {
      console.error('Error retrieving client details:', err);
      res.status(500).send('Error retrieving client details');
    } else {
      // Render the clienthistory.ejs file with the client details
      res.render('clienthistory', { user: results[0] }); // Pass the client details as "user"
    }
  });
});

// Route for rendering the edit form
app.get('/client/edit/:id', (req, res) => {
  const clientId = req.params.id;

  // Fetch the specific client item from the database
  const query = 'SELECT * FROM clients WHERE id = ?';
  connection.query(query, [clientId], (err, result) => {
    if (err) {
      console.error('Error fetching client:', err);
      res.status(500).send('Error fetching client');
    } else {
      const client = result[0];
      res.render('clientedit', { clientId, client }); // Use 'clientedit' here
    }
  });
});


// Route for handling the edit form submission for clients
app.post('/client/update/:id', (req, res) => {
  const clientId = req.params.id;
  const { firstname, lastname, address, email, contact_number } = req.body;

  // Construct the SQL query to update the client
  let updateQuery = 'UPDATE clients SET';
  const updateValues = [];

  if (firstname) {
    updateQuery += ' firstname = ?,';
    updateValues.push(firstname);
  }
  if (lastname) {
    updateQuery += ' lastname = ?,';
    updateValues.push(lastname);
  }
  if (address) {
    updateQuery += ' address = ?,';
    updateValues.push(address);
  }
  if (email) {
    updateQuery += ' email = ?,';
    updateValues.push(email);
  }
  if (contact_number) {
    updateQuery += ' contact_number = ?,';
    updateValues.push(contact_number);
  }

  // Remove the trailing comma if any fields were updated
  if (updateValues.length > 0) {
    updateQuery = updateQuery.slice(0, -1);
  }

  updateQuery += ' WHERE id = ?';
  updateValues.push(clientId);

  // Execute the query
  connection.query(updateQuery, updateValues, (error, results) => {
    if (error) {
      console.error('Error updating client:', error);
      return res.status(500).send('An error occurred while updating the client.');
    }

    console.log('Client updated successfully:', results);

    // Redirect to the client list or display a success message
    res.redirect('/clients');
  });
});

// Route for handling the add event form submission
app.post('/client/history/:clientId/add-event', (req, res) => {
  const clientId = req.params.clientId;
  const { eventDate, startTime, endTime, description } = req.body;

  // Insert the event into the events table
  const query = 'INSERT INTO events (client_id, event_date, event_start_time, event_end_time, event_description) VALUES (?, ?, ?, ?, ?)';
  const values = [clientId, eventDate, startTime, endTime, description];

  connection.query(query, values, (err, result) => {
    if (err) {
      console.error('Error adding event:', err);
      res.status(500).send('Error adding event');
    } else {
      res.redirect(`/client/history/${clientId}`); // Redirect back to the client history page after successful addition
    }
  });
});


// Function to get the event status based on event data
function getEventStatus(event) {
  const currentDate = new Date();
  const eventDate = new Date(event.event_date);

  if (currentDate.getDate() === eventDate.getDate() &&
      currentDate.getMonth() === eventDate.getMonth() &&
      currentDate.getFullYear() === eventDate.getFullYear()) {
    return "Ongoing";
  } else if (currentDate > eventDate) {
    return "Completed";
  } else {
    return "Upcoming";
  }
}


// Route for rendering the event history page
app.get('/client/history/:clientId/events', (req, res) => {
  const clientId = req.params.clientId;

  // Query the database to retrieve the events for the specific client
  const query = 'SELECT * FROM events WHERE client_id = ?';
  connection.query(query, [clientId], (err, results) => {
    if (err) {
      console.error('Error retrieving events:', err);
      res.status(500).send('Error retrieving events');
    } else {
      // Render the event history template with the events data
      res.render('eventhistory', { events: results, getEventStatus }); // Pass the function to the template
    }
  });
});


// Route to render the addinsupplies.ejs page with supplies for a specific event and search term
app.get('/addinsupplies/:eventId', async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const searchTerm = req.query.search || ''; // Get the search term from the query parameters

    // Fetch all supplies from the database that match the search term
    const suppliesQuery = `
      SELECT *
      FROM supply
      WHERE country LIKE '%${searchTerm}%'
      OR region LIKE '%${searchTerm}%'
      OR city LIKE '%${searchTerm}%'
    `;
    const supplies = await queryDatabase(suppliesQuery);

    // Fetch event data from the database based on the event ID (replace 'events' with your actual table name)
    const eventQuery = 'SELECT * FROM events WHERE id = ?';
    const event = await queryDatabase(eventQuery, [eventId]);

    if (!event || event.length === 0) {
      // Handle the case when the event with the given ID is not found
      res.status(404).send('Event not found');
      return;
    }

    // Fetch used supplies for the particular event from the database (replace 'event_supplies' with your actual table name)
    const usedSuppliesQuery = 'SELECT * FROM event_supplies WHERE event_id = ?';
    const usedSupplies = await queryDatabase(usedSuppliesQuery, [eventId]);

    // Render the addinsupplies.ejs page and pass the supplies, event, and usedSupplies data to it
    res.render('addinsupplies.ejs', { supplies, event: event[0], usedSupplies, searchTerm, refineSearchTerm: '' });
  } catch (err) {
    // Handle any errors that occur during the database query
    console.error('Error fetching data:', err);
    res.status(500).send('Internal Server Error');
  }
});



// Route to handle the second search bar (refine search)
app.get('/addinsupplies/:eventId/refine', async (req, res) => {
  try {
    const eventId = req.params.eventId;
    const { search, refineSearchTerm } = req.query;

    // Fetch all supplies based on the filters applied from the first search bar
    const supplies = await getFilteredSupplies(search);

    // Filter the supplies further based on the refine search term (name, description, category, sub_category)
    const refinedSupplies = supplies.filter(supply => {
      return (
        supply.name.toLowerCase().includes(refineSearchTerm.toLowerCase()) ||
        supply.description.toLowerCase().includes(refineSearchTerm.toLowerCase()) ||
        supply.category.toLowerCase().includes(refineSearchTerm.toLowerCase()) ||
        supply.sub_category.toLowerCase().includes(refineSearchTerm.toLowerCase())
      );
    });

    // Fetch event data from the database based on the event ID (replace 'events' with your actual table name)
    const eventQuery = 'SELECT * FROM events WHERE id = ?';
    const event = await queryDatabase(eventQuery, [eventId]);

    // Fetch used supplies for the particular event from the database (replace 'event_supplies' with your actual table name)
    const usedSuppliesQuery = 'SELECT * FROM event_supplies WHERE event_id = ?';
    const usedSupplies = await queryDatabase(usedSuppliesQuery, [eventId]);

    // Render the addinsupplies.ejs page and pass the supplies, event, and usedSupplies data to it
    res.render('addinsupplies.ejs', {
      supplies: refinedSupplies, // Use the refinedSupplies list
      event: event[0],
      usedSupplies,
      searchTerm: search, // Pass the search term from the first search bar
      refineSearchTerm // Pass the refine search term
    });
  } catch (err) {
    // Handle any errors that occur during the database query
    console.error('Error fetching data:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Function to fetch supplies based on the filters applied from the first search bar
async function getFilteredSupplies(searchTerm) {
  // Fetch all supplies from the database that match the search term
  const suppliesQuery = `
    SELECT *
    FROM supply
    WHERE country LIKE '%${searchTerm}%'
    OR region LIKE '%${searchTerm}%'
    OR city LIKE '%${searchTerm}%'
  `;
  const supplies = await queryDatabase(suppliesQuery);
  return supplies;
}


// Function to query the database (using a connection pool)
function queryDatabase(query, values = []) {
  return new Promise((resolve, reject) => {
    connection.query(query, values, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}

// Route to handle adding selected supplies to the event_supplies table
app.post('/addinsupplies/:eventId/addSupplies', async (req, res) => {
  const eventId = req.params.eventId;
  const selectedSupplies = req.body.selectedSupplies; // An array of selected supply IDs

  // Loop through the selected supply IDs and insert/update them in the event_supplies table along with their respective quantities
  for (const supplyId of selectedSupplies) {
    const quantityToAdd = parseInt(req.body[`quantity${supplyId}`]); // Convert to integer

    try {
      // Check if an entry already exists in the event_supplies table for the current event_id and supply_id
      const checkQuery = 'SELECT * FROM event_supplies WHERE event_id = ? AND supply_id = ?';
      const existingEntry = await queryDatabase(checkQuery, [eventId, supplyId]);

      if (existingEntry.length > 0) {
        // Entry already exists, retrieve the existing quantity
        const existingQuantity = existingEntry[0].quantity;

        // Calculate the new quantity by adding the existing quantity and the quantity to add
        const newQuantity = existingQuantity + quantityToAdd;

        // Update the existing entry with the new quantity
        const updateQuery = 'UPDATE event_supplies SET quantity = ? WHERE event_id = ? AND supply_id = ?';
        await queryDatabase(updateQuery, [newQuantity, eventId, supplyId]);
      } else {
        // Entry doesn't exist, insert a new row with the supply, quantity, and event_id
        const insertQuery = 'INSERT INTO event_supplies (event_id, supply_id, quantity) VALUES (?, ?, ?)';
        await queryDatabase(insertQuery, [eventId, supplyId, quantityToAdd]);
      }
    } catch (err) {
      console.error('Error checking or updating supply in event_supplies:', err);
      // Handle errors appropriately
    }
  }

  // Redirect back to the addinsupplies page after successful addition/update
  res.redirect(`/addinsupplies/${eventId}`);
});


// Route for rendering the viewusedsupplies.ejs template
app.get('/viewusedsupplies/:eventId', (req, res) => {
  const eventId = req.params.eventId;

  // Fetch all supplies used for the specified event along with additional supply information
  const getSuppliesUsedQuery = `
    SELECT s.*, es.quantity AS quantity_used, 
           (s.rate * es.quantity) AS total_rate,
           (s.rate * es.quantity) + (s.rate * es.quantity * 0.05) AS total_cost
    FROM supply AS s
    INNER JOIN event_supplies AS es ON s.id = es.supply_id
    WHERE es.event_id = ?
  `;

  connection.query(getSuppliesUsedQuery, [eventId], (err, suppliesUsed) => {
    if (err) {
      console.error('Error fetching supplies used:', err);
      res.status(500).send('Error fetching supplies used');
    } else {
      res.render('viewusedsupplies', {
        suppliesUsed: suppliesUsed,
      });
    }
  });
});


app.get('/previewbill/:eventId', (req, res) => {
  const eventId = req.params.eventId;

  // Query the database to fetch event information
  const eventQuery = 'SELECT * FROM events WHERE id = ?';
  connection.query(eventQuery, [eventId], (eventErr, eventResult) => {
    if (eventErr) {
      console.error('Error fetching event:', eventErr);
      res.status(500).send('Error fetching event');
    } else {
      const event = eventResult[0];

      // Query the database to fetch client information based on client ID
      const clientQuery = 'SELECT * FROM clients WHERE id = ?';
      connection.query(clientQuery, [event.client_id], (clientErr, clientResult) => {
        if (clientErr) {
          console.error('Error fetching client:', clientErr);
          res.status(500).send('Error fetching client');
        } else {
          const client = clientResult[0];

          // Query the database to fetch supplies used in the event
          const suppliesQuery = `
            SELECT s.*, es.quantity AS quantity_used, 
            (s.rate * es.quantity) AS total_rate,
            (s.rate * es.quantity) + (s.rate * es.quantity * 0.05) AS total_price
            FROM event_supplies AS es
            INNER JOIN supply AS s ON es.supply_id = s.id
            WHERE es.event_id = ?`;

          connection.query(suppliesQuery, [eventId], (suppliesErr, suppliesResult) => {
            if (suppliesErr) {
              console.error('Error fetching supplies:', suppliesErr);
              res.status(500).send('Error fetching supplies');
            } else {
              const supplies = suppliesResult;

              // Calculate the total amount for the preview
              const totalAmount = supplies.reduce((total, supply) => total + supply.total_price, 0);

              // Render the billpreview.ejs template with the necessary data
              res.render('billpreview', { client, event, supplies, totalAmount });
            }
          });
        }
      });
    }
  });
});





// Route for generating PDF from HTML content
app.post('/generate-pdf/:eventId', async (req, res) => {
  const { pdfContent, discount } = req.body;

  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Set the HTML content for the page
    await page.setContent(pdfContent);

    // Generate PDF with options
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });

    await browser.close();

    // Send the generated PDF as a response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=bill.pdf');
    res.send(pdf);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('Error generating PDF');
  }
});




// const pdf = require('html-pdf'); // Example PDF generation library
// const fs = require('fs');
// const { PDFDocument } = require('pdf-lib'); // PDF-lib for modifying PDF content

// app.use(express.urlencoded({ extended: true }));
// app.use(express.json());

// // Define a route for generating and saving PDFs
// app.post('/generate-pdf/:eventid', async (req, res) => {
//     const eventID = req.params.eventid;
//     const pdfContent = req.body.pdfContent;
//     const discount = req.body.discount;
//     const totalAmount = req.body.totalAmount;

//     // Generate PDF from HTML content using PDF-lib
//     const pdfDoc = await PDFDocument.create();
//     const page = pdfDoc.addPage();
//     const font = await pdfDoc.embedFont(PDFDocument.Font.Helvetica);
//     const { width, height } = page.getSize();

//     const fontSize = 12;
//     const textX = 50;
//     let textY = height - 50;

//     const lines = pdfContent.split('\n');
//     for (const line of lines) {
//         page.drawText(line, { x: textX, y: textY, font, size: fontSize });
//         textY -= fontSize + 5;
//     }

//     // Add discount and total amount information
//     page.drawText(`Discount: ${discount.toFixed(2)}`, { x: textX, y: textY, font, size: fontSize });
//     textY -= fontSize + 5;
//     page.drawText(`Net Amount: ${(totalAmount - discount).toFixed(2)}`, { x: textX, y: textY, font, size: fontSize });

//     // Save the PDF to a file
//     const pdfBytes = await pdfDoc.save();
//     fs.writeFileSync(`./pdfs/event_${eventID}_invoice.pdf`, pdfBytes);

//     return res.send('PDF generated and saved successfully');
// });





// Define route to display supply images
app.get('/displaySupplyImages/:supplyId', (req, res) => {
  const supplyId = req.params.supplyId;

  // Query the supply_images table to retrieve images associated with the supply
  const query = 'SELECT * FROM supply_images WHERE supply_id = ?';
  connection.query(query, [supplyId], (err, rows) => {
    if (err) {
      console.error('Error querying images:', err);
      res.status(500).send('Error querying images');
    } else {
      const images = rows; // Assign the retrieved rows to the 'images' variable
      
      console.log('Fetched images:', images);
      
      res.render('displaySupplyImages', { images, supplyId }); // Renders the EJS template
    }
  });
});


// Define route to display the editImages EJS template
app.get('/editImages/:supplyId', (req, res) => {
  const supplyId = req.params.supplyId;

  // Query the supply_images table to retrieve images associated with the supply
  const query = 'SELECT * FROM supply_images WHERE supply_id = ?';
  connection.query(query, [supplyId], (err, rows) => {
    if (err) {
      console.error('Error querying images:', err);
      res.status(500).send('Error querying images');
    } else {
      const images = rows; // Assign the retrieved rows to the 'images' variable

      console.log('Fetched images:', images);

      // Render the editImages EJS template and pass the 'images' and 'supplyId' variables to it
      res.render('editImages', { images, supplyId });
    }
  });
});


app.post('/editImages/:supplyId', upload.array('newImages'), (req, res) => {
  const supplyId = req.params.supplyId;
  const newImages = req.files;

  // Insert new images into the database
  const insertQuery = 'INSERT INTO supply_images (supply_id, image_data) VALUES (?, ?)';
  const insertValues = newImages.map(image => [supplyId, image.buffer]);

  connection.query(insertQuery, [insertValues], (insertErr, insertResult) => {
    if (insertErr) {
      console.error('Error inserting images:', insertErr);
      res.status(500).send('Error inserting images');
    } else {
      console.log('Images added');

      // Delete images that were marked for deletion
      const deletedImageIds = req.body.deletedImages || [];
      const deleteQuery = 'DELETE FROM supply_images WHERE id IN (?)';
      
      connection.query(deleteQuery, [deletedImageIds], (deleteErr, deleteResult) => {
        if (deleteErr) {
          console.error('Error deleting images:', deleteErr);
          res.status(500).send('Error deleting images');
        } else {
          console.log('Images deleted');
          res.redirect(`/editImages/${supplyId}`); // Redirect to the edit page
        }
      });
    }
  });
});

app.get('/viewbill/:eventId', (req, res) => {
  const eventId = req.params.eventId;

  // Query the events table to retrieve the billing information for the specified event
  const query = 'SELECT billing FROM events WHERE id = ?';
  connection.query(query, [eventId], (err, rows) => {
    if (err) {
      console.error('Error querying billing:', err);
      res.status(500).send('Error querying billing');
    } else {
      const billingInfo = rows[0].billing; // Retrieve the billing information

      // Render the viewbill.ejs template with the billing information
      res.render('viewbill', { billingInfo });
    }
  });
});





// Clear Node.js module cache
Object.keys(require.cache).forEach((key) => {
  delete require.cache[key];
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
