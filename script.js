/**
 * Library Management System - Frontend Controller
 * 
 * Manages UI rendering, state management, statistics computation,
 * custom modals, toast notifications, search filtering, and REST API calls
 * using async/await with robust error handling.
 */

// ==========================================================================
// Config & State
// ==========================================================================
const API_BASE_URL = 'http://127.0.0.1:8000';
let booksState = []; // Holds the list of books fetched from the backend
let deleteTargetId = null; // Stores book ID queued for deletion

// ==========================================================================
// DOM Elements
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Navigation & Mobile Menu
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.getElementById('navLinks');
    const navLinkItems = document.querySelectorAll('.nav-link');
    
    // Forms
    const addBookForm = document.getElementById('addBookForm');
    const updateBookForm = document.getElementById('updateBookForm');
    
    // Search
    const searchBar = document.getElementById('searchBar');
    
    // Modals
    const updateModal = document.getElementById('updateModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    
    const confirmDeleteModal = document.getElementById('confirmDeleteModal');
    const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
    const cancelDeleteModalBtn = document.getElementById('cancelDeleteModalBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    // Main UI components
    const bookGrid = document.getElementById('bookGrid');
    
    // ======================================================================
    // Initialization
    // ======================================================================
    initApp();

    function initApp() {
        // Fetch book list & database status on load
        refreshData();
        checkDatabaseStatus();
        
        // Start polling database status every 30 seconds
        setInterval(checkDatabaseStatus, 30000);
    }

    // ======================================================================
    // Event Listeners Setup
    // ======================================================================

    // Mobile Menu Toggle
    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = navToggle.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.className = 'fa-solid fa-xmark';
            } else {
                icon.className = 'fa-solid fa-bars';
            }
        });
    }

    // Smooth navigation active class toggling
    navLinkItems.forEach(link => {
        link.addEventListener('click', (e) => {
            navLinkItems.forEach(item => item.classList.remove('active'));
            link.classList.add('active');
            // Close mobile menu if open
            if (navLinks && navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                const icon = navToggle.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-bars';
            }
        });
    });

    // Add Book Form Submission
    if (addBookForm) {
        addBookForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('bookTitle');
            const authorInput = document.getElementById('bookAuthor');
            
            const title = titleInput.value.trim();
            const author = authorInput.value.trim();
            
            if (title && author) {
                const success = await addBookAPI(title, author);
                if (success) {
                    titleInput.value = '';
                    authorInput.value = '';
                    await refreshData();
                }
            }
        });
    }

    // Update Book Form Submission
    if (updateBookForm) {
        updateBookForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('updateBookId').value;
            const title = document.getElementById('updateBookTitle').value.trim();
            const author = document.getElementById('updateBookAuthor').value.trim();
            
            if (id && title && author) {
                const success = await updateBookAPI(id, title, author);
                if (success) {
                    closeModal(updateModal);
                    await refreshData();
                }
            }
        });
    }

    // Instant Search Filter Input
    if (searchBar) {
        searchBar.addEventListener('input', (e) => {
            const filterValue = e.target.value.toLowerCase().trim();
            renderBooks(filterValue);
        });
    }

    // Close Modals buttons listeners
    if (closeModalBtn) closeModalBtn.addEventListener('click', () => closeModal(updateModal));
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', () => closeModal(updateModal));
    
    if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', () => closeModal(confirmDeleteModal));
    if (cancelDeleteModalBtn) cancelDeleteModalBtn.addEventListener('click', () => closeModal(confirmDeleteModal));
    
    // Confirm delete click action
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (deleteTargetId) {
                const success = await deleteBookAPI(deleteTargetId);
                if (success) {
                    closeModal(confirmDeleteModal);
                    await refreshData();
                }
            }
        });
    }

    // Modal click-outside logic to close
    window.addEventListener('click', (e) => {
        if (e.target === updateModal) closeModal(updateModal);
        if (e.target === confirmDeleteModal) closeModal(confirmDeleteModal);
    });

    // Event delegation on the Book Grid for card action buttons
    if (bookGrid) {
        bookGrid.addEventListener('click', async (e) => {
            const button = e.target.closest('.btn-card-action');
            if (!button) return;
            
            const bookCard = button.closest('.book-card');
            if (!bookCard) return;
            
            const id = bookCard.dataset.id;
            const title = bookCard.dataset.title;
            const author = bookCard.dataset.author;
            const action = button.dataset.action;
            
            if (action === 'issue') {
                const success = await issueBookAPI(id);
                if (success) await refreshData();
            } else if (action === 'return') {
                const success = await returnBookAPI(id);
                if (success) await refreshData();
            } else if (action === 'delete') {
                openDeleteConfirmation(id, title);
            } else if (action === 'update') {
                openUpdateModal(id, title, author);
            }
        });
    }
});

// ==========================================================================
// API Layer (Backend Fetch Commands)
// ==========================================================================

/**
 * Validates backend database connection status and updates UI card.
 */
async function checkDatabaseStatus() {
    const dbIndicator = document.getElementById('statDbStatus');
    const dbIcon = document.getElementById('dbStatusIcon');
    
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        if (response.ok) {
            if (dbIndicator) {
                dbIndicator.className = "stat-value text-success";
                dbIndicator.innerHTML = '<span class="status-indicator online"></span> Online';
            }
            if (dbIcon) {
                dbIcon.className = "stat-icon-wrapper purple-glow";
            }
            return true;
        }
    } catch (err) {
        // Server offline
    }
    
    // Set offline style
    if (dbIndicator) {
        dbIndicator.className = "stat-value text-danger";
        dbIndicator.innerHTML = '<span class="status-indicator offline"></span> Offline';
    }
    if (dbIcon) {
        dbIcon.className = "stat-icon-wrapper red-glow";
    }
    return false;
}

/**
 * Retrieves all books from the API database.
 */
async function fetchBooksAPI() {
    const response = await fetch(`${API_BASE_URL}/books`);
    if (!response.ok) {
        throw new Error(`Failed to fetch books: Status ${response.status}`);
    }
    return await response.json();
}

/**
 * Creates a new book entry in the database.
 */
async function addBookAPI(title, author) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/books`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, author })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Book Added Successfully', 'success');
            return true;
        } else {
            showToast(data.detail || 'Failed to add book', 'error');
            return false;
        }
    } catch (error) {
        console.error(error);
        showToast('Network error: Unable to add book', 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

/**
 * Updates details of an existing book.
 */
async function updateBookAPI(id, title, author) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/books/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, author })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Book Updated Successfully', 'success');
            return true;
        } else {
            showToast(data.detail || 'Failed to update book', 'error');
            return false;
        }
    } catch (error) {
        console.error(error);
        showToast('Network error: Unable to update book', 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

/**
 * Deletes a book from the system.
 */
async function deleteBookAPI(id) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/books/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Book Deleted Successfully', 'success');
            return true;
        } else {
            showToast(data.detail || 'Failed to delete book', 'error');
            return false;
        }
    } catch (error) {
        console.error(error);
        showToast('Network error: Unable to delete book', 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

/**
 * Marks a book status as issued (available = false).
 */
async function issueBookAPI(id) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/books/${id}/issue`, {
            method: 'PUT'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Book Issued Successfully', 'success');
            return true;
        } else {
            showToast(data.detail || 'Failed to issue book', 'error');
            return false;
        }
    } catch (error) {
        console.error(error);
        showToast('Network error: Unable to issue book', 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

/**
 * Marks a book status as returned (available = true).
 */
async function returnBookAPI(id) {
    showLoading(true);
    try {
        const response = await fetch(`${API_BASE_URL}/books/${id}/return`, {
            method: 'PUT'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Book Returned Successfully', 'success');
            return true;
        } else {
            showToast(data.detail || 'Failed to return book', 'error');
            return false;
        }
    } catch (error) {
        console.error(error);
        showToast('Network error: Unable to return book', 'error');
        return false;
    } finally {
        showLoading(false);
    }
}

// ==========================================================================
// Controller / Data Orchestration
// ==========================================================================

/**
 * Fetches all books from the API, updates global state and renders dashboard.
 */
async function refreshData() {
    showLoading(true);
    try {
        booksState = await fetchBooksAPI();
        
        // Refresh local UI
        const searchBar = document.getElementById('searchBar');
        const filterText = searchBar ? searchBar.value.toLowerCase().trim() : '';
        renderBooks(filterText);
        updateStatistics();
        
        // Confirm DB status online since fetch worked
        const dbIndicator = document.getElementById('statDbStatus');
        if (dbIndicator) {
            dbIndicator.className = "stat-value text-success";
            dbIndicator.innerHTML = '<span class="status-indicator online"></span> Online';
        }
    } catch (error) {
        console.error("Data refresh failed", error);
        showToast('Could not fetch book directory. Backend is offline.', 'error');
        
        // Render empty layout or current state
        renderBooks('');
        updateStatistics();
        
        // Update database indicator offline
        const dbIndicator = document.getElementById('statDbStatus');
        if (dbIndicator) {
            dbIndicator.className = "stat-value text-danger";
            dbIndicator.innerHTML = '<span class="status-indicator offline"></span> Offline';
        }
    } finally {
        showLoading(false);
    }
}

/**
 * Updates stats cards counts based on cached memory state.
 */
function updateStatistics() {
    const totalCount = booksState.length;
    const availableCount = booksState.filter(b => b.available).length;
    const issuedCount = totalCount - availableCount;
    
    const statTotal = document.getElementById('statTotal');
    const statAvailable = document.getElementById('statAvailable');
    const statIssued = document.getElementById('statIssued');
    
    if (statTotal) statTotal.textContent = totalCount;
    if (statAvailable) statAvailable.textContent = availableCount;
    if (statIssued) statIssued.textContent = issuedCount;
}

/**
 * Renders book cards to the DOM grid with matching filters.
 */
function renderBooks(filter = '') {
    const bookGrid = document.getElementById('bookGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!bookGrid) return;
    
    // Clear previous items
    bookGrid.innerHTML = '';
    
    // Filter books based on search term
    const filteredBooks = booksState.filter(book => {
        const titleMatch = book.title.toLowerCase().includes(filter);
        const authorMatch = book.author.toLowerCase().includes(filter);
        return titleMatch || authorMatch;
    });
    
    // Check if empty
    if (filteredBooks.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }
    
    if (emptyState) emptyState.classList.add('hidden');
    
    // Generate markup for each card
    filteredBooks.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card glass-card';
        card.dataset.id = book.id;
        card.dataset.title = book.title;
        card.dataset.author = book.author;
        
        const availabilityText = book.available ? 'Available' : 'Issued';
        const badgeClass = book.available ? 'available' : 'issued';
        
        card.innerHTML = `
            <div class="book-card-main">
                <div class="book-card-header">
                    <span class="badge-status ${badgeClass}">${availabilityText}</span>
                </div>
                <h3 class="book-card-title">${escapeHTML(book.title)}</h3>
                <div class="book-card-author">
                    <i class="fa-solid fa-user-nib"></i>
                    <span>${escapeHTML(book.author)}</span>
                </div>
            </div>
            <div class="book-card-actions">
                <button type="button" class="btn btn-secondary btn-sm btn-card-action" data-action="update" title="Edit book details">
                    <i class="fa-solid fa-pen"></i> Update
                </button>
                <button type="button" class="btn btn-danger btn-sm btn-card-action" data-action="delete" title="Delete book">
                    <i class="fa-solid fa-trash-can"></i> Delete
                </button>
                <div class="btn-action-group">
                    <button type="button" class="btn btn-primary btn-sm btn-card-action" data-action="issue" ${!book.available ? 'disabled' : ''} title="Issue Book">
                        <i class="fa-solid fa-arrow-right-from-bracket"></i> Issue
                    </button>
                    <button type="button" class="btn btn-success btn-sm btn-card-action" data-action="return" ${book.available ? 'disabled' : ''} title="Return Book">
                        <i class="fa-solid fa-arrow-rotate-left"></i> Return
                    </button>
                </div>
            </div>
        `;
        bookGrid.appendChild(card);
    });
}

// ==========================================================================
// Modal Controllers
// ==========================================================================

function openUpdateModal(id, title, author) {
    const updateModal = document.getElementById('updateModal');
    const updateBookId = document.getElementById('updateBookId');
    const updateBookTitle = document.getElementById('updateBookTitle');
    const updateBookAuthor = document.getElementById('updateBookAuthor');
    
    if (updateModal && updateBookId && updateBookTitle && updateBookAuthor) {
        updateBookId.value = id;
        updateBookTitle.value = title;
        updateBookAuthor.value = author;
        
        // Remove hidden class and focus title input
        updateModal.classList.remove('hidden');
        updateBookTitle.focus();
    }
}

function openDeleteConfirmation(id, title) {
    const confirmDeleteModal = document.getElementById('confirmDeleteModal');
    const deleteBookTitleText = document.getElementById('deleteBookTitleText');
    
    if (confirmDeleteModal && deleteBookTitleText) {
        deleteTargetId = id;
        deleteBookTitleText.textContent = `"${title}"`;
        confirmDeleteModal.classList.remove('hidden');
    }
}

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.classList.add('hidden');
        if (modalElement.id === 'confirmDeleteModal') {
            deleteTargetId = null;
        }
    }
}

// ==========================================================================
// Utility / Helper Functions
// ==========================================================================

/**
 * Toggles loader overlay screen visibility.
 */
function showLoading(show) {
    const loader = document.getElementById('loadingOverlay');
    if (!loader) return;
    
    if (show) {
        loader.classList.remove('hidden');
    } else {
        loader.classList.add('hidden');
    }
}

/**
 * Spawns dynamic toast message card.
 * @param {string} message Text message to show
 * @param {'success' | 'error' | 'info'} type Style template category
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Choose icon based on toast class type
    let iconClass = 'fa-solid fa-circle-check';
    if (type === 'error') iconClass = 'fa-solid fa-circle-exclamation';
    if (type === 'info') iconClass = 'fa-solid fa-circle-info';
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="${iconClass} toast-icon"></i>
            <span class="toast-message">${escapeHTML(message)}</span>
        </div>
        <button class="toast-close" aria-label="Close toast">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;
    
    // Click event to close manually
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });
    
    // Append to container
    container.appendChild(toast);
    
    // Automatically self-dismiss after 4 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            removeToast(toast);
        }
    }, 4000);
}

function removeToast(toastElement) {
    toastElement.classList.add('removing');
    // Wait for fadeout animation to complete
    toastElement.addEventListener('animationend', (e) => {
        if (e.animationName === 'toastFadeOut') {
            toastElement.remove();
        }
    });
}

/**
 * Escapes unsafe text nodes to avoid XSS injections.
 */
function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
