const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const path = require('path');

const app = express();
const port = 3000;

// Set up session middleware
app.use(
  session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: true,
  })
);

// Set up body-parser middleware
app.use(bodyParser.urlencoded({ extended: false }));

// Configure MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'projectdb',
});

// Connect to MySQL
connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL server');
});


// Set up the Express middleware to parse request bodies
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Set up static files middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'pages')); // Set the views directory to 'pages'

// Route for serving the login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

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
        // Credentials are correct
        const user = results[0];
        req.session.loggedInUser = user.role;
        if (user.role === 'support') {
          res.redirect('/clients'); // Redirect to the registration page for support users
        } else {
          res.redirect('/home'); // Redirect to the home page for other users
        }
      } else {
        // Invalid credentials
        res.send('Invalid username or password.');
      }
    }
  });
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


// Route to render the admin.ejs template
app.get('/admin', (req, res) => {
  // Query the supply table
  connection.query('SELECT * FROM supply', (err, rows) => {
    if (err) {
      console.error('Error querying supply table: ', err);
      return;
    }
    // Render the admin.ejs template with the supply data
    res.render('admin', { supplies: rows });
  });
});


// Route for handling the edit form submission
app.post('/edit/:id', (req, res) => {
  const supplyId = req.params.id;
  const { name, image, description, category, sub_category, country, region, city, quantity, rate } = req.body;

  // Update the corresponding record in the supply table
  const query = 'UPDATE supply SET name = ?, image = ?, description = ?, category = ?, sub_category = ?, country = ?, region = ?, city = ?, quantity = ?, rate = ? WHERE id = ?';
  connection.query(query, [name, image, description, category, sub_category, country, region, city, quantity, rate, supplyId], (err, result) => {
    if (err) {
      console.error('Error updating supply:', err);
      res.status(500).send('Error updating supply');
    } else {
      res.redirect('/admin'); // Redirect back to the admin page after successful update
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
      res.render('adminedit', { supply }); // Render the adminedit.ejs template with the supply data
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


// Route for handling the addition of a new supply
app.post('/addSupply', (req, res) => {
  const { name, image, description, category, sub_category, country, region, city, quantity, rate } = req.body;

  const query = 'INSERT INTO supply (name, image, description, category, sub_category, country, region, city, quantity, rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const values = [name, image, description, category, sub_category, country, region, city, quantity, rate];

  connection.query(query, values, (err, result) => {
    if (err) {
      console.error('Error adding supply:', err);
      res.status(500).send('Error adding supply');
    } else {
      res.redirect('/admin'); // Redirect back to the admin page after successful addition
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





const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Specify the destination folder for uploaded files
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Use the original filename for the uploaded file
  }
  });
  const upload = multer({ storage: storage });




// Route for handling the file upload
app.post('/upload', upload.single('image'), (req, res) => {
  // Access the uploaded file details through req.file
  if (!req.file) {
    // If no file was uploaded, handle the error
    res.status(400).send('No file uploaded');
    return;
  }

   // Process the uploaded file as needed
   const filePath = req.file.path;

   // Render the uploaded.ejs template with the image path
   res.render('uploaded', { image: '/uploads/' + req.file.filename });
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


// Route for rendering the viewusedsupplies.ejs template
app.get('/viewusedsupplies/:eventId', (req, res) => {
  const eventId = req.params.eventId;

  // Fetch the event details for displaying on the page
  const getEventQuery = 'SELECT * FROM events WHERE id = ?';
  connection.query(getEventQuery, [eventId], (err, event) => {
    if (err) {
      console.error('Error fetching event details:', err);
      res.status(500).send('Error fetching event details');
    } else {
      // Fetch all supplies used for the specified event
      const getSuppliesUsedQuery = 'SELECT * FROM event_supplies WHERE event_id = ?';
      connection.query(getSuppliesUsedQuery, [eventId], (err, suppliesUsed) => {
        if (err) {
          console.error('Error fetching supplies used:', err);
          res.status(500).send('Error fetching supplies used');
        } else {
          res.render('viewusedsupplies', {
            event: event[0],
            suppliesUsed: suppliesUsed,
          });
        }
      });
    }
  });
});



// Route to view supplies used for a specific event
app.get('/viewsupplies/:event_id', (req, res) => {
  const eventId = req.params.event_id;
  const action = req.query.action;

  if (action === 'view') {
    const getSuppliesQuery = 'SELECT * FROM event_supplies WHERE event_id = ?';
    connection.query(getSuppliesQuery, [eventId], (err, supplies) => {
      if (err) {
        console.error('Error fetching supplies used:', err);
        res.status(500).send('Error fetching supplies used');
      } else {
        // Fetch the event details for displaying on the page
        const getEventQuery = 'SELECT * FROM events WHERE id = ?';
        connection.query(getEventQuery, [eventId], (err, event) => {
          if (err) {
            console.error('Error fetching event details:', err);
            res.status(500).send('Error fetching event details');
          } else {
            res.render('viewusedsupplies', {
              event: event[0],
              suppliesUsed: supplies,
            });
          }
        });
      }
    });
  } else if (action === 'add') {
    // Fetch all supplies from the database for the dropdown selection
    const getAllSuppliesQuery = 'SELECT * FROM supply';
    connection.query(getAllSuppliesQuery, (err, allSupplies) => {
      if (err) {
        console.error('Error fetching all supplies:', err);
        res.status(500).send('Error fetching all supplies');
      } else {
        // Fetch the event details for displaying on the page
        const getEventQuery = 'SELECT * FROM events WHERE id = ?';
        connection.query(getEventQuery, [eventId], (err, event) => {
          if (err) {
            console.error('Error fetching event details:', err);
            res.status(500).send('Error fetching event details');
          } else {
            res.render('addinsupplies', {
              event: event[0],
              allSupplies: allSupplies,
            });
          }
        });
      }
    });
  } else {
    // Invalid action parameter, handle the error or redirect to a default page
    res.status(400).send('Invalid action parameter');
  }
});



// Clear Node.js module cache
Object.keys(require.cache).forEach((key) => {
  delete require.cache[key];
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
