Talescape

Talescape is an innovative platform designed to help readers find books in nearby libraries. With Talescape, users can search for books available in libraries, view detailed information about the books and libraries, and check the distance between their location and the library. Users can also reserve books, track their availability, and navigate to the libraries using Google Maps.
Key Features

    Search Books: Browse available books in nearby libraries.
    Sorted by Distance: Libraries are sorted by proximity to your location, with distance shown.
    Book Details: Get detailed information about the book, including author, genre, and price.
    Reserve Books: Reserve books available in nearby libraries.
    Add Books to Libraries: Libraries can add new books or update existing ones.
    Library Management: Libraries can manage their inventory, including modifying prices, adding new books, and viewing reserved books.
    Admin Page: Admin users can manage books and libraries, including adding new libraries, and controlling reserved books.
    Google Maps Integration: Navigate to the library's location using Google Maps.

Technologies Used

    Frontend: HTML, CSS, JavaScript
    Backend: PHP, MySQL (using phpMyAdmin for database management)
    Containerization: Docker (for environment consistency)

How Talescape Works

    Open the app and search for the book you want to read.
    View nearby libraries that have the book available.
    Reserve the book from the closest library.
    Use Google Maps to navigate to the library.

Admin Panel

The admin panel allows for complete management of:

    Books in libraries (add, update, remove).
    Prices and availability of books.
    Library management (add, delete, modify libraries).
    Reserved books and user activity.

Screenshots

Here are some screenshots of the platform:

<div>
  <img src="Screenshots/home_page_screenshot.jpg" alt="Home Page" width="300">
  <img src="Screenshots/library_page_screenshot.jpg" alt="Library Page" width="300">
  <img src="Screenshots/admin_dashboard_screenshot.jpg" alt="Admin Dashboard" width="300">
  <img src="Screenshots/google_maps_screenshot.jpg" alt="Google Maps" width="300">
</div>


Getting Started

    Clone the repository:

git clone https://github.com/talescape/talescape.git

Install Docker (if not already installed):

    Docker Installation Guide

Build and run the app using Docker:

docker-compose up --build

Access the app in your browser at http://localhost:3000.

For phpMyAdmin, go to http://localhost:8080 to manage the database.
