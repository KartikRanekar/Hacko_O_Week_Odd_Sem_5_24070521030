import os
import sqlite3
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ----------------------------------
# FastAPI App
# ----------------------------------

app = FastAPI(
    title="Library Management System API",
    version="1.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ----------------------------------
# Database Configuration
# ----------------------------------

DATABASE_FOLDER = "database"
DATABASE_NAME = "library.db"

os.makedirs(DATABASE_FOLDER, exist_ok=True)

DATABASE_PATH = os.path.join(DATABASE_FOLDER, DATABASE_NAME)

conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
cursor = conn.cursor()

# Create Books Table
cursor.execute("""
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    available INTEGER DEFAULT 1
)
""")

conn.commit()

# ----------------------------------
# Pydantic Model
# ----------------------------------

class Book(BaseModel):
    title: str
    author: str

# ----------------------------------
# Home Route
# ----------------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to the Library Management System API"
    }

# ----------------------------------
# Add Book
# ----------------------------------

@app.post("/books")
def add_book(book: Book):

    cursor.execute(
        """
        INSERT INTO books(title, author, available)
        VALUES (?, ?, ?)
        """,
        (book.title, book.author, 1)
    )

    conn.commit()

    return {
        "message": "Book added successfully"
    }

# ----------------------------------
# Get All Books
# ----------------------------------

@app.get("/books")
def get_books():

    cursor.execute("SELECT * FROM books")

    rows = cursor.fetchall()

    books = []

    for row in rows:
        books.append({
            "id": row[0],
            "title": row[1],
            "author": row[2],
            "available": bool(row[3])
        })

    return books

# ----------------------------------
# Get Book By ID
# ----------------------------------

@app.get("/books/{book_id}")
def get_book(book_id: int):

    cursor.execute(
        "SELECT * FROM books WHERE id=?",
        (book_id,)
    )

    row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Book not found"
        )

    return {
        "id": row[0],
        "title": row[1],
        "author": row[2],
        "available": bool(row[3])
    }

# ----------------------------------
# Update Book
# ----------------------------------

@app.put("/books/{book_id}")
def update_book(book_id: int, book: Book):

    cursor.execute(
        """
        UPDATE books
        SET title=?, author=?
        WHERE id=?
        """,
        (book.title, book.author, book_id)
    )

    conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Book not found"
        )

    return {
        "message": "Book updated successfully"
    }

# ----------------------------------
# Delete Book
# ----------------------------------

@app.delete("/books/{book_id}")
def delete_book(book_id: int):

    cursor.execute(
        "DELETE FROM books WHERE id=?",
        (book_id,)
    )

    conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Book not found"
        )

    return {
        "message": "Book deleted successfully"
    }

# ----------------------------------
# Issue Book
# ----------------------------------

@app.put("/books/{book_id}/issue")
def issue_book(book_id: int):

    cursor.execute(
        "SELECT available FROM books WHERE id=?",
        (book_id,)
    )

    row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Book not found"
        )

    if row[0] == 0:
        raise HTTPException(
            status_code=400,
            detail="Book already issued"
        )

    cursor.execute(
        "UPDATE books SET available=0 WHERE id=?",
        (book_id,)
    )

    conn.commit()

    return {
        "message": "Book issued successfully"
    }

# ----------------------------------
# Return Book
# ----------------------------------

@app.put("/books/{book_id}/return")
def return_book(book_id: int):

    cursor.execute(
        "SELECT available FROM books WHERE id=?",
        (book_id,)
    )

    row = cursor.fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Book not found"
        )

    if row[0] == 1:
        raise HTTPException(
            status_code=400,
            detail="Book is already available"
        )

    cursor.execute(
        "UPDATE books SET available=1 WHERE id=?",
        (book_id,)
    )

    conn.commit()

    return {
        "message": "Book returned successfully"
    }