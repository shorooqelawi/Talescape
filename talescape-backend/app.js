const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer'); 
const geolib = require('geolib');
const axios = require('axios');
// إنشاء الخادم
const app = express();
const port = 3000;

const db = mysql.createConnection({
  host: 'db',          // اسم الخدمة في docker-compose.yml (الخدمة الخاصة بـ MySQL)
  user: 'root',
  password: 'example', // كلمة المرور التي حددتها في docker-compose.yml
  database: 'talescape' // اسم قاعدة البيانات
});

// تأكد من أن الاتصال تم بنجاح
db.connect(err => {
  if (err) {
    console.error('خطأ في الاتصال بـ MySQL:', err);
    return;
  }
  console.log('تم الاتصال بـ MySQL بنجاح!');
});

// تفعيل CORS للسماح بالاتصال من كافة النطاقات
app.use(cors());


// إعداد تحليل البيانات من الطلبات
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// إضافة السطر الذي يخدم الصور من مجلد 'books_cover'
app.use('/books_cover', express.static('books_cover', {
  setHeaders: function (res, path) {
    console.log('Serving images from /books_cover');
  }
}));

//signup as reader
app.post('/signup', (req, res) => {
  const { username, email, password, confirmPassword, city, phone_number, latitude, longitude } = req.body;

  // Check if all required fields are present
  if (!username || !email || !password || !confirmPassword || !city || !phone_number) {
      return res.status(400).send('All fields are required');
  }

  // Validate the email using a regex pattern
  const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  if (!emailPattern.test(email)) {
      return res.status(400).send('Invalid email address');
  }

  // Check if the password matches the confirm password
  if (password !== confirmPassword) {
      return res.status(400).send('Password and confirm password do not match');
  }

  // Validate the phone number using a regex pattern for Jordanian numbers
  const phonePattern = /^(\+962|0)7[789]\d{7}$/;
  if (!phonePattern.test(phone_number)) {
      return res.status(400).send('Invalid Jordanian phone number. Please use +9627XXXXXXXX or 07XXXXXXXX.');
  }

  // Check if the email already exists in the database
  const checkQuery = 'SELECT * FROM readers WHERE email = ?';
  db.query(checkQuery, [email], (err, result) => {
      if (err) {
          return res.status(500).send('Database connection error');
      }

      if (result.length > 0) {
          return res.status(400).send('Email is already in use');
      }

      // Hash the password
      bcrypt.hash(password, 10, (err, hashedPassword) => {
          if (err) {
              return res.status(500).send('Error hashing the password');
          }

          // Insert data into the readers table
          const query = 'INSERT INTO readers (username, email, password, city, phone_number, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)';
          db.query(query, [username, email, hashedPassword, city, phone_number, latitude || 0, longitude || 0], (err, result) => {
              if (err) {
                  return res.status(500).send('An error occurred during registration');
              }

              // On successful registration, send a text response
              res.status(200).send('Registration successful!');
          });
      });
  });
});
  
// Login page (Login) reader
app.post('/login', (req, res) => {
  const { email, password, latitude, longitude } = req.body;

  // Check if the required data is present
  if (!email || !password) {
      return res.status(400).send('Email or password is missing');
  }

  // Search for the user in the database
  const query = 'SELECT * FROM readers WHERE email = ?';
  db.query(query, [email], (err, result) => {
      if (err) {
          return res.status(500).send('Database connection error');
      }

      if (result.length === 0) {
          return res.status(400).send('Email does not exist');
      }

      // Compare the entered password with the stored password
      bcrypt.compare(password, result[0].password, (err, match) => {
          if (err) {
              return res.status(500).send('Error during comparison');
          }

          if (!match) {
              return res.status(400).send('Incorrect password');
          }

          // Update latitude and longitude in the database
          const updateQuery = 'UPDATE readers SET latitude = ?, longitude = ? WHERE email = ?';
          db.query(updateQuery, [latitude, longitude, email], (err, result) => {
              if (err) {
                  return res.status(500).send('Error updating location');
              }

              res.status(200).send('Logged in successfully!');
          });
      });
  });
});




// تكوين nodemailer باستخدام بيانات 
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
      user: 'talescapepro@gmail.com', // بريدك الإلكتروني
      pass: 'pdwt yllv yhfj hkwl ' // كلمة مرور التطبيق التي أنشأتها
  }
});

// إنشاء رمز عشوائي
function generateRandomCode() {
  return Math.floor(100000 + Math.random() * 900000); // رمز مكون من 6 أرقام
}

// Endpoint لنسيت كلمة المرور for reader
app.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  // التحقق من وجود البريد الإلكتروني في قاعدة البيانات
  const query = 'SELECT * FROM readers WHERE email = ?';
  db.query(query, [email], (err, result) => {
      if (err) {
          console.error('Error checking email:', err);
          return res.status(500).json({ message: 'Server error' });
      }

      if (result.length === 0) {
          return res.status(400).json({ message: 'Email not found' });
      }

      // إنشاء رمز عشوائي
      const resetCode = generateRandomCode();

      // إرسال البريد الإلكتروني
      const mailOptions = {
          from: 'your-email@gmail.com', // البريد الإلكتروني المرسل
          to: email, // البريد الإلكتروني المستلم
          subject: 'Password Reset Code', // موضوع البريد الإلكتروني
          text: `Your password reset code is: ${resetCode}`, // نص البريد الإلكتروني
          html: `<p>Your password reset code is: <strong>${resetCode}</strong></p>` // نص HTML (اختياري)
      };

      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              console.error('Error sending email:', error);
              return res.status(500).json({ message: 'Failed to send reset code' });
          }

          // تخزين الرمز في قاعدة البيانات
          const updateQuery = 'UPDATE readers SET reset_code = ? WHERE email = ?';
          db.query(updateQuery, [resetCode, email], (err, result) => {
              if (err) {
                  console.error('Error updating reset code:', err);
                  return res.status(500).json({ message: 'Server error' });
              }

              // إرسال رسالة نجاح وتوجيه المستخدم إلى صفحة إعادة تعيين كلمة المرور
              res.status(200).json({ 
                  message: 'Reset code sent to your email.', 
                  redirectToReset: true 
              });
          });
      });
  });
});


// Endpoint لتأكيد الرمز وتغيير كلمة المرور for reader
app.post('/reset-password', (req, res) => {
  const { email, resetCode, newPassword } = req.body;

  // التحقق من صحة الرمز
  const query = 'SELECT * FROM readers WHERE email = ? AND reset_code = ?';
  db.query(query, [email, resetCode], (err, result) => {
      if (err) {
          console.error('Error checking reset code:', err);
          return res.status(500).json({ message: 'Server error' });
      }

      if (result.length === 0) {
          return res.status(400).json({ message: 'Invalid reset code' });
      }

      // تشفير كلمة المرور الجديدة
      bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
          if (err) {
              return res.status(500).json({ message: 'Error hashing password' });
          }

          // تحديث كلمة المرور وإزالة الرمز
          const updateQuery = 'UPDATE readers SET password = ?, reset_code = NULL WHERE email = ?';
          db.query(updateQuery, [hashedPassword, email], (err, result) => {
              if (err) {
                  console.error('Error updating password:', err);
                  return res.status(500).json({ message: 'Server error' });
              }

              // إرسال رسالة نجاح
              res.status(200).json({ message: 'Password updated successfully!' });
          });
      });
  });
});

// عرض قائمة الكتب book list page
app.get('/books', (req, res) => {
  const query = 'SELECT * FROM books';
  db.query(query, (err, results) => {
      if (err) {
        return res.status(500).send('Error fetching books from the database');
      }
      res.json(results);  // إرجاع الكتب في تنسيق JSON
  });
});




// عرض قائمة المكتبات libraries list page
app.get('/libraries', (req, res) => {
  const query = 'SELECT * FROM libraries';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).send('Error fetching libraries from the database');
    }
    res.json(results);  // إرجاع المكتبات في تنسيق JSON
  });
});

app.get('/book/:id', (req, res) => {
  const bookId = req.params.id;

  // استعلام لجلب بيانات الكتاب فقط (بدون المكتبات في البداية)
  const query = `
    SELECT b.bookid, b.title, b.author, b.category, b.description, b.image_url
    FROM books b
    WHERE b.bookid = ?
  `;

  db.query(query, [bookId], (err, result) => {
    if (err) {
      console.error('Error executing query:', err);  // طباعة الخطأ في وحدة التحكم
      return res.status(500).send('خطأ في جلب بيانات الكتاب');
    }

    if (result.length === 0) {
      return res.status(404).send('الكتاب غير موجود');
    }

    const book = result[0];
    res.json(book);  // إرسال تفاصيل الكتاب فقط
  });
});



// دالة لتحويل العنوان إلى إحداثيات باستخدام Nominatim
async function getCoordinates(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`;

  try {
    console.log("Sending request to Nominatim with address:", address);
    const response = await axios.get(url);
    console.log("Nominatim Response:", response.data);

    if (response.data.length > 0) {
      const { lat, lon } = response.data[0];
      console.log("Coordinates found:", lat, lon);
      return { latitude: parseFloat(lat), longitude: parseFloat(lon) };
    } else {
      throw new Error('Address not found');
    }
  } catch (error) {
    console.error('Error fetching coordinates:', error);
    throw error;
  }
}

// Endpoint for library registration
app.post('/signup-library', async (req, res) => {
  const {
    libraryName, email, password, confirmPassword, phoneNumber, city,
    typeOfLibrary, address, openingTime, closingTime, libraryDescription,
    libraryWebsite, availableServices, preferredLanguage
  } = req.body;

  // Check if all required fields are present
  if (!libraryName || !email || !password || !confirmPassword || !phoneNumber || !city || 
      !typeOfLibrary || !address || !openingTime || !closingTime || !libraryDescription || 
      !libraryWebsite || !availableServices || !preferredLanguage) {
      return res.status(400).json({ message: 'All fields are required' });
  }

  // Check if password matches confirm password
  if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Password and confirm password do not match' });
  }

  // Validate the email
  const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  if (!emailPattern.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
  }

  // Check if the email already exists in the database
  const checkQuery = 'SELECT * FROM libraries WHERE email = ?';
  db.query(checkQuery, [email], (err, result) => {
      if (err) {
          return res.status(500).json({ message: 'Database connection error' });
      }

      if (result.length > 0) {
          return res.status(400).json({ message: 'Email is already in use' });
      }

      // Hash the password
      bcrypt.hash(password, 10, (err, hashedPassword) => {
          if (err) {
              return res.status(500).json({ message: 'Error hashing the password' });
          }

          // Convert address to coordinates
          getCoordinates(address)
            .then(({ latitude, longitude }) => {
                // Insert data into the database
                const query = `
                    INSERT INTO libraries (library_name, email, password, phone_number, city, type_of_library, 
                                           library_location_latitude, library_location_longitude, opening_time, closing_time, 
                                           library_description, library_website_url, available_services, preferred_language) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                db.query(query, [libraryName, email, hashedPassword, phoneNumber, city, typeOfLibrary,
                                 latitude, longitude, openingTime, closingTime, libraryDescription, 
                                 libraryWebsite, availableServices, preferredLanguage], (err, result) => {
                    if (err) {
                        return res.status(500).json({ message: 'Error adding data to the database' });
                    }
                    res.status(200).json({ message: 'Library registration completed successfully!' });
                });
            })
            .catch(error => {
                res.status(500).json({ message: 'Error converting address to coordinates', error: error.message });
            });
      });
  });
});


// Library login page
app.post('/login-library', (req, res) => {
  const { email, password } = req.body;  // Use email instead of username

  // Check if the required data is present
  if (!email || !password) {
      return res.status(400).json({ message: 'Email or password is missing' }); // إرسال رسالة خطأ بتنسيق JSON
  }

  // Search for the library in the database using the email
  const query = 'SELECT * FROM libraries WHERE email = ?';
  db.query(query, [email], (err, result) => {
      if (err) {
          return res.status(500).json({ message: 'Database connection error' }); // إرسال رسالة خطأ بتنسيق JSON
      }

      if (result.length === 0) {
          return res.status(400).json({ message: 'Email does not exist' }); // إرسال رسالة خطأ بتنسيق JSON
      }

      // Compare the entered password with the stored password
      bcrypt.compare(password, result[0].password, (err, match) => {
          if (err) {
              return res.status(500).json({ message: 'Error during comparison' }); // إرسال رسالة خطأ بتنسيق JSON
          }

          if (!match) {
              return res.status(400).json({ message: 'Incorrect password' }); // إرسال رسالة خطأ بتنسيق JSON
          }

          // Send a JSON response for successful login
          res.status(200).json({ message: 'Logged in successfully!' });
      });
  });
});

// Endpoint لنسيت كلمة المرور للمكتبة
app.post('/forgot-password-library', (req, res) => {
  const { email } = req.body;

  // التحقق من وجود البريد الإلكتروني في جدول libraries
  const query = 'SELECT * FROM libraries WHERE email = ?';
  db.query(query, [email], (err, result) => {
      if (err) {
          console.error('Error checking email:', err);
          return res.status(500).json({ message: 'Server error' });
      }

      if (result.length === 0) {
          return res.status(400).json({ message: 'Email not found' });
      }

      // إنشاء رمز عشوائي
      const resetCode = generateRandomCode();

      // إرسال البريد الإلكتروني
      const mailOptions = {
          from: 'talescapepro@gmail.com', // البريد الإلكتروني المرسل
          to: email, // البريد الإلكتروني المستلم
          subject: 'Password Reset Code', // موضوع البريد الإلكتروني
          text: `Your password reset code is: ${resetCode}`, // نص البريد الإلكتروني
          html: `<p>Your password reset code is: <strong>${resetCode}</strong></p>` // نص HTML (اختياري)
      };

      transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
              console.error('Error sending email:', error);
              return res.status(500).json({ message: 'Failed to send reset code' });
          }

          // تخزين الرمز في قاعدة البيانات
          const updateQuery = 'UPDATE libraries SET reset_code = ? WHERE email = ?';
          db.query(updateQuery, [resetCode, email], (err, result) => {
              if (err) {
                  console.error('Error updating reset code:', err);
                  return res.status(500).json({ message: 'Server error' });
              }

              // إرسال رسالة نجاح وتوجيه المستخدم إلى صفحة إعادة تعيين كلمة المرور
              res.status(200).json({ 
                  message: 'Reset code sent to your email.', 
                  redirectToReset: true 
              });
          });
      });
  });
});

// Endpoint لتأكيد الرمز وتغيير كلمة المرور للمكتبة
app.post('/reset-password-library', (req, res) => {
  const { email, resetCode, newPassword } = req.body;

  // التحقق من صحة الرمز
  const query = 'SELECT * FROM libraries WHERE email = ? AND reset_code = ?';
  db.query(query, [email, resetCode], (err, result) => {
      if (err) {
          console.error('Error checking reset code:', err);
          return res.status(500).json({ message: 'Server error' });
      }

      if (result.length === 0) {
          return res.status(400).json({ message: 'Invalid reset code' });
      }

      // تشفير كلمة المرور الجديدة
      bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
          if (err) {
              return res.status(500).json({ message: 'Error hashing password' });
          }

          // تحديث كلمة المرور وإزالة الرمز
          const updateQuery = 'UPDATE libraries SET password = ?, reset_code = NULL WHERE email = ?';
          db.query(updateQuery, [hashedPassword, email], (err, result) => {
              if (err) {
                  console.error('Error updating password:', err);
                  return res.status(500).json({ message: 'Server error' });
              }

              // إرسال رسالة نجاح
              res.status(200).json({ message: 'Password updated successfully!' });
          });
      });
  });
});




// جلب الكتب الخاصة بالمكتبة مع السعر mylibrary page
app.get('/my-library', (req, res) => {
  const userEmail = req.query.email;
  if (!userEmail) {
    return res.status(400).send('البريد الإلكتروني مطلوب');
  }

  const query = `
    SELECT books.*, library_books.price FROM books
    JOIN library_books ON books.bookid = library_books.book_id
    JOIN libraries ON libraries.email = library_books.library_email
    WHERE libraries.email = ?
  `;
  
  db.query(query, [userEmail], (err, results) => {
    if (err) {
      console.error('خطأ في جلب الكتب:', err);
      return res.status(500).send('حدث خطأ أثناء جلب الكتب');
    }
    res.json(results);
  });
});

// Add a book to the library with a price from Recently Added Books page
app.post('/add-book-to-library', (req, res) => {
  const { email, bookId, price } = req.body;

  if (!email || !bookId || !price) {
    return res.status(400).json({ success: false, message: 'Email, book ID, and price are required' });
  }

  const query = `
    INSERT INTO library_books (library_email, book_id, price)
    VALUES (?, ?, ?)
  `;
  
  db.query(query, [email, bookId, price], (err, results) => {
    if (err) {
      console.error('Error while adding the book to the library:', err);
      return res.status(500).json({ success: false, message: 'An error occurred while adding the book to the library' });
    }
    res.json({ success: true, message: 'The book has been added successfully' });
  });
});

// Fetch all available books for Recently Added Books page
app.get('/get-all-books', (req, res) => {
  const query = 'SELECT * FROM books';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching books:', err);
      return res.status(500).json({ message: 'An error occurred while fetching books' });
    }
    res.json(results);
  });
});


// الحصول على الكتب الخاصة بالمكتبة للمستخدم بناءً على الفلاتر mylibrary page
app.get('/my-library', (req, res) => {
  const { email, category, search } = req.query;

  // بناء الاستعلام
  let query = `
    SELECT books.bookid, books.title, books.author, books.category, books.description, books.image_url, library_books.price
    FROM library_books
    JOIN books ON library_books.book_id = books.bookid
    WHERE library_books.library_email = ?
  `;
  const params = [email];

  // إضافة الفلاتر إن كانت موجودة
  if (category) {
    query += ` AND books.category = ?`;
    params.push(category);
  }

  if (search) {
    query += ` AND (books.title LIKE ? OR books.author LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  // تنفيذ الاستعلام
  db.query(query, params, (err, results) => {
    if (err) {
      console.log('Error executing query:', err);
      return res.status(500).json({ message: 'Error fetching books' });
    }
    
    res.json(results);  // إرسال الكتب المتوافقة مع الفلاتر
  });
});

//delete book for my library page
app.delete('/delete-book', (req, res) => {
  const { email, bookId } = req.body;

  if (!email || !bookId) {
    return res.status(400).json({ success: false, message: 'Email and bookId are required' });
  }

  const query = 'DELETE FROM library_books WHERE library_email = ? AND book_id = ?';
  db.query(query, [email, Number(bookId)], (err, result) => {  // تحويل bookId إلى رقم
    if (err) {
      console.error('Error deleting book:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error deleting book',
        error: err.message  // إظهار تفاصيل الخطأ
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Book not found in your library' });
    }

    res.json({ success: true, message: 'Book deleted successfully' });
  });
});


//update price for my library page
app.put('/update-book-price', (req, res) => {
  const { email, bookId, newPrice } = req.body;

  if (!email || !bookId || !newPrice) {
    return res.status(400).json({ success: false, message: 'Email, bookId, and newPrice are required' });
  }

  const query = 'UPDATE library_books SET price = ? WHERE library_email = ? AND book_id = ?';
  db.query(query, [newPrice, email, Number(bookId)], (err, result) => {  // تحويل bookId إلى رقم
    if (err) {
      console.error('Error updating book price:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error updating book price',
        error: err.message  // إظهار تفاصيل الخطأ
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Book not found in your library' });
    }

    res.json({ success: true, message: 'Price updated successfully' });
  });
});

// دالة للتحقق من وجود الكتاب في جدول books add-book page 
app.get('/check-book', (req, res) => {
  const { title } = req.query;
  const query = `SELECT * FROM books WHERE title = ?`;
  db.query(query, [title], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ exists: results.length > 0, bookId: results.length > 0 ? results[0].bookid : null });
  });
});

// دالة لإضافة كتاب إلى جدول books books add-book page 
app.post('/add-book', (req, res) => {
  const { title, author, category, description, image_url, price, libraryEmail } = req.body;

  // التحقق من أن جميع الحقول موجودة
  if (!title || !author || !category || !description || !price || !libraryEmail) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // التحقق من وجود الكتاب في جدول books
  const queryCheckBook = `SELECT * FROM books WHERE title = ?`;
  db.query(queryCheckBook, [title], (err, results) => {
    if (err) return res.status(500).json({ message: 'Error checking book', error: err });

    if (results.length > 0) {
      // إذا كان الكتاب موجودًا، أرسل الـ book_id
      const bookId = results[0].bookid;
      res.json({ success: true, bookId: bookId });
    } else {
      // إذا لم يكن الكتاب موجودًا، أضفه إلى جدول books
      const queryAddBook = `INSERT INTO books (title, author, category, description, image_url) VALUES (?, ?, ?, ?, ?)`;
      db.query(queryAddBook, [title, author, category, description, image_url], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error adding book', error: err });

        const bookId = result.insertId; // الحصول على الـ ID للكتاب المضاف
        res.json({ success: true, bookId: bookId });
      });
    }
  });
});

// دالة للتحقق من وجود الكتاب في جدول library_books (books add-book page )
app.get('/check-library-book', (req, res) => {
  const { bookId, email } = req.query;
  const query = `SELECT * FROM library_books WHERE book_id = ? AND library_email = ?`;
  db.query(query, [bookId, email], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ exists: results.length > 0 });
  });
});

// دالة لإضافة كتاب إلى جدول library_books (books add-book page )
app.post('/add-library-book', (req, res) => {
  const { bookId, price, libraryEmail } = req.body;
  const query = `INSERT INTO library_books (book_id, price, library_email) VALUES (?, ?, ?)`;
  db.query(query, [bookId, price, libraryEmail], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true });
  });
});

// عرض قائمة الكتب في تصنيف التكنولوجيا فقط
app.get('/books-tec', (req, res) => {
  const query = 'SELECT * FROM books WHERE category = "Technology"';
  db.query(query, (err, results) => {
      if (err) {
          return res.status(500).send('خطأ في جلب الكتب من قاعدة البيانات');
      }
      res.json(results);  
  });
});

// عرض قائمة الكتب في تصنيف History فقط
app.get('/books-history', (req, res) => {
  const query = 'SELECT * FROM books WHERE category = "History"';
  db.query(query, (err, results) => {
      if (err) {
          return res.status(500).send('Error fetching books from the database');
      }
      res.json(results);  
  });
});

// عرض قائمة الكتب في تصنيف Religion فقط
app.get('/books-religion', (req, res) => {
  const query = 'SELECT * FROM books WHERE category = "Religion"';
  db.query(query, (err, results) => {
      if (err) {
          return res.status(500).send('Error fetching books from the database');
      }
      res.json(results);  
  });
});

// عرض قائمة الكتب في تصنيف Science فقط
app.get('/books-science', (req, res) => {
  const query = 'SELECT * FROM books WHERE category = "Science"';
  db.query(query, (err, results) => {
      if (err) {
          return res.status(500).send('Error fetching books from the database');
      }
      res.json(results);  
  });
});

// عرض قائمة الكتب في تصنيف Literature فقط
app.get('/books-literature', (req, res) => {
  const query = 'SELECT * FROM books WHERE category = "Literature"';
  db.query(query, (err, results) => {
      if (err) {
          return res.status(500).send('Error fetching books from the database');
      }
      res.json(results);  
  });
});

// عرض قائمة الكتب في تصنيف English فقط
app.get('/books-english', (req, res) => {
  const query = 'SELECT * FROM books WHERE category = "English"';
  db.query(query, (err, results) => {
      if (err) {
          return res.status(500).send('Error fetching books from the database');
      }
      res.json(results);  // إرجاع الكتب في تنسيق JSON
  });
});

// view details book page (book-detail.html)
app.post('/library_books', async (req, res) => {
  const { bookId } = req.body;

  if (!bookId) {
    return res.status(400).json({ error: 'Book ID is required' });
  }

  try {
    // الاستعلام للحصول على الكتاب والمكتبات المرتبطة بالـ bookId
    const query = `
      SELECT 
        b.title AS book_title,
        b.author AS book_author,  -- إضافة اسم الكاتب
        b.category AS book_category,  -- إضافة التصنيف
        b.description AS book_description,  -- إضافة الوصف
        b.image_url AS book_image,
        lb.price,
        l.library_name,
        l.city,
        l.email
      FROM library_books lb
      JOIN libraries l ON lb.library_email = l.email
      JOIN books b ON lb.book_id = b.bookid
      WHERE lb.book_id = ?
    `;

    db.query(query, [bookId], (error, results) => {
      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (results.length === 0) {
        return res.status(404).json({ message: 'No libraries found for this book' });
      }

      // إرسال الكتاب والمكتبات المتاحة مع تفاصيل الكتاب
      res.json(results);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// استلام بيانات الحجز وإضافتها إلى الجدول
app.post('/add_reservation', (req, res) => {
  const { library_name, book_id, reader_email, pickup_method, notes, created_at } = req.body;

  console.log('Received data:', req.body);  // طباعة البيانات المستلمة

  // تحقق من أن البيانات صحيحة
  if (!library_name || !book_id || !reader_email || !pickup_method) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // استعلام للتحقق من وجود حجز سابق
  const checkQuery = `
    SELECT * FROM reservations 
    WHERE library_name = ? 
    AND book_id = ? 
    AND reader_email = ?
  `;

  console.log('Executing checkQuery with params:', [library_name, book_id, reader_email]);  // إضافة سجل لتتبع الاستعلام

  db.query(checkQuery, [library_name, book_id, reader_email], (error, results) => {
    if (error) {
      console.error('Error checking reservation:', error);  // طباعة الخطأ
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // إذا تم العثور على حجز سابق، نرسل رسالة للمستخدم
    if (results.length > 0) {
      console.log('Existing reservation found:', results);  // إضافة سجل لعرض النتائج الموجودة
      return res.status(400).json({ error: 'You have already reserved this book from this library.' });
    }

    // إذا لم يتم العثور على حجز سابق، نكمل الحجز
    const query = `
      INSERT INTO reservations (library_name, book_id, reader_email, pickup_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [library_name, book_id, reader_email, pickup_method, notes, created_at], (error, results) => {
      if (error) {
        console.error('Error inserting reservation:', error);  // طباعة الخطأ
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.status(200).json({ message: 'Reservation added successfully', id: results.insertId });
    });
  });
});


// View library details along with the books available in it
app.get('/libraryDetails/:libraryId', (req, res) => {
  const libraryId = req.params.libraryId;
  const query = 'SELECT * FROM libraries WHERE id = ?';
  db.query(query, [libraryId], (err, results) => {
      if (err) {
          return res.status(500).send('Error fetching library details');
      }
      if (results.length === 0) {
          return res.status(404).send('Library not found');
      }
      res.json(results[0]);  // Return library details
  });
});

// View books available in the library based on the library's email
app.get('/booksForLibrary/:libraryEmail', (req, res) => {
  const libraryEmail = req.params.libraryEmail;
  const query = `
    SELECT books.bookid, books.title, books.author, books.category, books.description, books.image_url, library_books.price 
    FROM books 
    JOIN library_books ON books.bookid = library_books.book_id 
    WHERE library_books.library_email = ?
  `;
  
  db.query(query, [libraryEmail], (err, results) => {
    if (err) {
      return res.status(500).send('Error fetching books');
    }

    console.log('Books returned:', results);  // Print results to verify the presence of bookid
    res.json(results);  // Return books available in the library
  });
});


app.post('/add_reservation-inlibrary', (req, res) => {
  console.log('Received data:', req.body);  // تحقق من البيانات الواردة

  const { library_name, book_id, reader_email, pickup_method, notes, created_at } = req.body;

  if (!library_name || !book_id || !reader_email || !pickup_method) {
    console.log('Missing required fields');
    return res.status(400).json({ error: 'All fields are required' });
  }

  // استعلام للتحقق من وجود حجز سابق
  const checkQuery = `
    SELECT * FROM reservations 
    WHERE library_name = ? 
    AND book_id = ? 
    AND reader_email = ?
  `;

  console.log('Executing checkQuery with params:', [library_name, book_id, reader_email]);  // إضافة سجل لتتبع الاستعلام

  db.query(checkQuery, [library_name, book_id, reader_email], (error, results) => {
    if (error) {
      console.error('Error checking reservation:', error);  // طباعة الخطأ
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // إذا تم العثور على حجز سابق، نرسل رسالة للمستخدم
    if (results.length > 0) {
      console.log('Existing reservation found:', results);  // إضافة سجل لعرض النتائج الموجودة
      return res.status(400).json({ error: 'You have already reserved this book from this library.' });
    }

    // إذا لم يتم العثور على حجز سابق، نكمل الحجز
    const query = `
      INSERT INTO reservations (library_name, book_id, reader_email, pickup_method, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [library_name, book_id, reader_email, pickup_method, notes, created_at], (error, results) => {
      if (error) {
        console.error('Error inserting reservation:', error);  // طباعة الخطأ
        return res.status(500).json({ error: 'Internal Server Error' });
      }
      res.status(200).json({ message: 'Reservation added successfully', id: results.insertId });
    });
  });
});


app.post('/check_reservation', (req, res) => {
  const { reader_email, book_id } = req.body;
  console.log('Checking reservation for', reader_email, book_id);
  // تحقق من الحجز في قاعدة البيانات
  const reservationExists = checkIfReserved(reader_email, book_id);  // قم بالتحقق هنا من الحجز في قاعدة البيانات
  res.json({ reservationExists });
});

// Search endpoint
app.get('/search', (req, res) => {
  const searchTerm = req.query.term;
  const readerLat = req.query.readerLat; // خط عرض القارئ
  const readerLon = req.query.readerLon; // خط طول القارئ
  const city = req.query.city; // المدينة المحددة

  let query;
  let queryParams;

  if (readerLat && readerLon) {
      // البحث مع حساب المسافة إذا كانت إحداثيات القارئ متاحة
      query = `
          SELECT b.bookid, b.title, b.author, b.category, b.description, b.image_url, 
                 lb.library_email, lb.price, l.id AS library_id, l.library_name, l.city,
                 l.library_location_latitude AS library_latitude, l.library_location_longitude AS library_longitude,
                 6371 * ACOS(
                     COS(RADIANS(?)) * COS(RADIANS(l.library_location_latitude)) * COS(RADIANS(l.library_location_longitude) - RADIANS(?)) +
                     SIN(RADIANS(?)) * SIN(RADIANS(l.library_location_latitude))
                 ) AS distance
          FROM books b
          JOIN library_books lb ON b.bookid = lb.book_id
          JOIN libraries l ON lb.library_email = l.email
          WHERE b.title LIKE ?
          ${city ? 'AND l.city = ?' : ''}
          ORDER BY distance ASC
      `;
      queryParams = [readerLat, readerLon, readerLat, `%${searchTerm}%`];
      if (city) {
          queryParams.push(city);
      }
  } else if (city) {
      // البحث حسب المدينة إذا تم تحديدها
      query = `
          SELECT b.bookid, b.title, b.author, b.category, b.description, b.image_url, 
                 lb.library_email, lb.price, l.id AS library_id, l.library_name, l.city,
                 l.library_location_latitude AS library_latitude, l.library_location_longitude AS library_longitude
          FROM books b
          JOIN library_books lb ON b.bookid = lb.book_id
          JOIN libraries l ON lb.library_email = l.email
          WHERE b.title LIKE ? AND l.city = ?
      `;
      queryParams = [`%${searchTerm}%`, city];
  } else {
      // البحث بدون ترتيب حسب المسافة أو المدينة
      query = `
          SELECT b.bookid, b.title, b.author, b.category, b.description, b.image_url, 
                 lb.library_email, lb.price, l.id AS library_id, l.library_name, l.city,
                 l.library_location_latitude AS library_latitude, l.library_location_longitude AS library_longitude
          FROM books b
          JOIN library_books lb ON b.bookid = lb.book_id
          JOIN libraries l ON lb.library_email = l.email
          WHERE b.title LIKE ?
      `;
      queryParams = [`%${searchTerm}%`];
  }

  // تنفيذ الاستعلام
  db.query(query, queryParams, (err, results) => {
      if (err) {
          console.error("Error executing query:", err);
          return res.status(500).json({ error: "Internal Server Error", details: err.message });
      }

      console.log("Search Results:", results); // طباعة النتائج للتأكد
      res.json(results);
  });
});
// نقطة النهاية لجلب تفاصيل الكتاب والمكتبة
app.get('/book-details', (req, res) => {
  const bookId = req.query.bookId;
  const libraryEmail = req.query.libraryEmail;

  if (!bookId || !libraryEmail) {
      return res.status(400).json({ error: 'Book ID and Library Email are required' });
  }

  const query = `
      SELECT 
          b.bookid, b.title, b.author, b.category, b.description, b.image_url,
          lb.price, l.library_name, l.city, l.library_location_latitude, l.library_location_longitude
      FROM books b
      JOIN library_books lb ON b.bookid = lb.book_id
      JOIN libraries l ON lb.library_email = l.email
      WHERE b.bookid = ? AND l.email = ?
  `;

  db.query(query, [bookId, libraryEmail], (err, results) => {
      if (err) {
          console.error('Error fetching book details:', err);
          return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (results.length === 0) {
          return res.status(404).json({ message: 'Book not found in the specified library' });
      }

      res.json(results[0]);
  });
});

// جلب الكتب المحجوزة للمكتبة الحالية
app.get('/reserved-books', (req, res) => {
  const libraryEmail = req.query.email;

  if (!libraryEmail) {
      return res.status(400).json({ error: 'Email is required' });
  }

  const query = `
      SELECT 
          r.id AS reservation_id,
          r.library_name,
          r.book_id,
          r.reader_email,
          r.pickup_method,
          r.notes,
          r.created_at,
          b.title,
          b.author,
          rd.username AS reader_username,
          rd.email AS reader_email,
          rd.phone_number AS reader_phone
      FROM reservations r
      JOIN books b ON r.book_id = b.bookid
      JOIN readers rd ON r.reader_email = rd.email
      WHERE r.library_name = (SELECT library_name FROM libraries WHERE email = ?)
  `;

  db.query(query, [libraryEmail], (err, results) => {
      if (err) {
          console.error('Error executing query:', err);
          return res.status(500).json({ error: 'Error fetching reserved books', details: err.message });
      }

      res.json(results);
  });
});
// إلغاء الحجز
app.delete('/cancel-reservation/:reservationId', (req, res) => {
  const reservationId = req.params.reservationId;

  const query = 'DELETE FROM reservations WHERE id = ?';

  db.query(query, [reservationId], (err, results) => {
      if (err) {
          console.error('Error executing query:', err);
          return res.status(500).json({ error: 'Error canceling reservation', details: err.message });
      }

      if (results.affectedRows === 0) {
          return res.status(404).json({ error: 'Reservation not found' });
      }

      res.json({ message: 'Reservation canceled successfully' });
  });
});


// Endpoint لجلب جميع المكتبات
app.get('/libraries', (req, res) => {
  const query = 'SELECT * FROM libraries';
  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'Error fetching libraries' });
    }
    res.json(results);
  });
});




// Endpoint لحذف مكتبة
app.delete('/delete-library/:libraryId', (req, res) => {
  const libraryId = req.params.libraryId;

  // حذف المكتبة من جدول libraries
  const query = 'DELETE FROM libraries WHERE id = ?';
  db.query(query, [libraryId], (err, result) => {
      if (err) {
          return res.status(500).json({ success: false, message: 'Error deleting library' });
      }

      if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, message: 'Library not found' });
      }

      // حذف الكتب المرتبطة بالمكتبة من جدول library_books
      const deleteBooksQuery = 'DELETE FROM library_books WHERE library_email = (SELECT email FROM libraries WHERE id = ?)';
      db.query(deleteBooksQuery, [libraryId], (err, result) => {
          if (err) {
              return res.status(500).json({ success: false, message: 'Error deleting associated books' });
          }

          res.json({ success: true, message: 'Library and associated books deleted successfully' });
      });
  });
});

// Endpoint لإضافة مسؤول جديد
app.post('/add-admin', (req, res) => {
  const { username, email, password } = req.body;

  // تشفير كلمة المرور
  bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
          return res.status(500).send('Error hashing password');
      }

      // إدخال البيانات في جدول admins
      const query = 'INSERT INTO admins (username, email, password) VALUES (?, ?, ?)';
      db.query(query, [username, email, hashedPassword], (err, results) => {
          if (err) {
              return res.status(500).send('Error adding admin');
          }
          res.send('Admin added successfully!');
      });
  });
});

// Endpoint لتسجيل دخول المسؤولين
app.post('/login-admin', (req, res) => {
  const { email, password } = req.body;

  const query = 'SELECT * FROM admins WHERE email = ?';
  db.query(query, [email], (err, results) => {
      if (err) {
          return res.status(500).send('Database error');
      }
      if (results.length === 0) {
          return res.status(400).send('Email not found');
      }

      const admin = results[0];
      bcrypt.compare(password, admin.password, (err, match) => {
          if (err) {
              return res.status(500).send('Error comparing passwords');
          }
          if (!match) {
              return res.status(400).send('Incorrect password');
          }
          res.send('Logged in successfully!');
      });
  });
});

// Endpoint لجلب تفاصيل المكتبة والكتب
app.get('/library-details', (req, res) => {
  const libraryEmail = req.query.email;

  // جلب تفاصيل المكتبة
  const libraryQuery = 'SELECT * FROM libraries WHERE email = ?';
  db.query(libraryQuery, [libraryEmail], (err, libraryResults) => {
      if (err) {
          return res.status(500).json({ error: 'Error fetching library details' });
      }

      if (libraryResults.length === 0) {
          return res.status(404).json({ error: 'Library not found' });
      }

      // جلب الكتب المرتبطة بالمكتبة
      const booksQuery = `
          SELECT b.bookid, b.title, b.author, b.category, b.description, b.image_url, lb.price
          FROM library_books lb
          JOIN books b ON lb.book_id = b.bookid
          WHERE lb.library_email = ?
      `;
      db.query(booksQuery, [libraryEmail], (err, booksResults) => {
          if (err) {
              return res.status(500).json({ error: 'Error fetching books' });
          }

          res.json({ library: libraryResults[0], books: booksResults });
      });
  });
});

// Endpoint لحذف كتاب
app.delete('/delete-book', (req, res) => {
  const { bookId, libraryEmail } = req.body;

  const query = 'DELETE FROM library_books WHERE book_id = ? AND library_email = ?';
  db.query(query, [bookId, libraryEmail], (err, result) => {
      if (err) {
          return res.status(500).json({ success: false, message: 'Error deleting book' });
      }

      if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, message: 'Book not found in this library' });
      }

      res.json({ success: true, message: 'Book deleted successfully' });
  });
});

// Endpoint لحذف مكتبة بالكامل
app.delete('/delete-library-by-email', (req, res) => {
  const libraryEmail = req.query.email;

  // حذف المكتبة من جدول libraries
  const deleteLibraryQuery = 'DELETE FROM libraries WHERE email = ?';
  db.query(deleteLibraryQuery, [libraryEmail], (err, result) => {
      if (err) {
          return res.status(500).json({ success: false, message: 'Error deleting library' });
      }

      if (result.affectedRows === 0) {
          return res.status(404).json({ success: false, message: 'Library not found' });
      }

      // حذف الكتب المرتبطة بالمكتبة من جدول library_books
      const deleteBooksQuery = 'DELETE FROM library_books WHERE library_email = ?';
      db.query(deleteBooksQuery, [libraryEmail], (err, result) => {
          if (err) {
              return res.status(500).json({ success: false, message: 'Error deleting associated books' });
          }

          res.json({ success: true, message: 'Library and associated books deleted successfully' });
      });
  });
});


// تشغيل الخادم
app.listen(port, () => {
  console.log(`الخادم يعمل على http://localhost:${port}`);
});
