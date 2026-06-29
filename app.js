import { auth, db, isFirebaseConfigured } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- DOM Elements ---
// Auth
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authToggleLink = document.getElementById('toggle-auth-mode');
const authToggleText = document.getElementById('auth-toggle-text');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const googleLoginBtn = document.getElementById('google-login-btn');

// App Header
const userEmailDisplay = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');

// Dashboard & Stats
const totalItemsCount = document.getElementById('total-items-count');
const totalStockCount = document.getElementById('total-stock-count');
const searchInput = document.getElementById('search-input');
const inventoryGrid = document.getElementById('inventory-grid');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');

// Item Modal
const openAddModalBtn = document.getElementById('open-add-modal');
const itemModal = document.getElementById('item-modal');
const closeModalBtn = document.getElementById('close-modal');
const cancelModalBtn = document.getElementById('cancel-modal');
const itemForm = document.getElementById('item-form');
const itemNameInput = document.getElementById('item-name');
const itemPictureInput = document.getElementById('item-picture');
const itemPiecesInput = document.getElementById('item-pieces');
const piecesPerBoxInput = document.getElementById('pieces-per-box');
const numberOfBoxesInput = document.getElementById('number-of-boxes');
const boxPriceInput = document.getElementById('box-price');
const piecePriceInput = document.getElementById('piece-price');

// Drop Stock Modal
const dropModal = document.getElementById('drop-modal');
const closeDropModalBtn = document.getElementById('close-drop-modal');
const cancelDropModalBtn = document.getElementById('cancel-drop-modal');
const dropForm = document.getElementById('drop-form');
const dropItemName = document.getElementById('drop-item-name');
const dropCurrentStock = document.getElementById('drop-current-stock');
const dropAmountInput = document.getElementById('drop-amount');

// Toast
const toast = document.getElementById('toast');

// Tabs & Views
const tabBtns = document.querySelectorAll('.tab-btn');
const inventoryView = document.getElementById('inventory-view');
const salesView = document.getElementById('sales-view');

// Sales UI
const sales24h = document.getElementById('sales-24h');
const salesTotalRevenue = document.getElementById('sales-total-revenue');
const salesTotalItems = document.getElementById('sales-total-items');
const transactionsList = document.getElementById('transactions-list');
const salesEmptyState = document.getElementById('sales-empty-state');
const salesFilterType = document.getElementById('sales-filter-type');
const salesDateFilter = document.getElementById('sales-date-filter');
const salesMonthFilter = document.getElementById('sales-month-filter');

// --- State ---
let isLoginMode = true;
let currentUser = null;
let inventoryData = [];
let transactionsData = [];
let currentEditItemId = null;
let currentDropItemId = null;
let unsubscribeSnapshot = null;
let unsubscribeTransactions = null;

// Mock user for LocalStorage fallback
const MOCK_USER = { uid: 'local-user', email: 'demo@shopledger.local' };

// --- Initialization ---
function init() {
    if (isFirebaseConfigured) {
        // Listen for Firebase Auth state changes
        onAuthStateChanged(auth, (user) => {
            if (user) {
                handleLoginSuccess(user);
            } else {
                handleLogout();
            }
        });
    } else {
        // Mock Auth fallback
        const savedMockUser = localStorage.getItem('shop_ledger_mock_user');
        if (savedMockUser) {
            handleLoginSuccess(JSON.parse(savedMockUser));
        } else {
            handleLogout();
        }
    }
}

// --- Utilities ---
function showToast(message, isError = false) {
    toast.textContent = message;
    if (isError) {
        toast.classList.add('error');
    } else {
        toast.classList.remove('error');
    }
    toast.classList.remove('hidden');
    // small delay for css transition
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
}

// Compress and resize image to prevent storage limits
async function processImage(file, maxWidth = 800) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to 70% quality JPEG
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
}

// --- Authentication Logic ---
authToggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authSubmitBtn.querySelector('span').textContent = 'Login';
        authToggleText.innerHTML = `Don't have an account? <a href="#" id="toggle-auth-mode">Sign up</a>`;
    } else {
        authSubmitBtn.querySelector('span').textContent = 'Sign Up';
        authToggleText.innerHTML = `Already have an account? <a href="#" id="toggle-auth-mode">Login</a>`;
    }
    // Reattach listener to the newly created element
    document.getElementById('toggle-auth-mode').addEventListener('click', arguments.callee);
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    authSubmitBtn.disabled = true;
    authSubmitBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px; margin: 0;"></div>';

    if (isFirebaseConfigured) {
        try {
            if (isLoginMode) {
                await signInWithEmailAndPassword(auth, email, password);
                showToast("Logged in successfully!");
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
                showToast("Account created successfully!");
            }
        } catch (error) {
            showToast(error.message, true);
        }
    } else {
        // Mock Auth Logic
        setTimeout(() => {
            const user = { uid: 'local-user-' + Date.now(), email };
            localStorage.setItem('shop_ledger_mock_user', JSON.stringify(user));
            handleLoginSuccess(user);
            showToast(isLoginMode ? "Logged in (Mock Mode)" : "Signed up (Mock Mode)");
        }, 800);
    }

    authSubmitBtn.disabled = false;
    authSubmitBtn.innerHTML = `<span>${isLoginMode ? 'Login' : 'Sign Up'}</span><i class="fa-solid fa-arrow-right"></i>`;
});

googleLoginBtn.addEventListener('click', async () => {
    if (isFirebaseConfigured) {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            showToast("Logged in with Google successfully!");
        } catch (error) {
            showToast(error.message, true);
        }
    } else {
        showToast("Google Sign-in requires Firebase to be configured.", true);
    }
});

logoutBtn.addEventListener('click', async () => {
    if (isFirebaseConfigured) {
        try {
            await signOut(auth);
        } catch (error) {
            showToast("Error logging out", true);
        }
    } else {
        localStorage.removeItem('shop_ledger_mock_user');
        handleLogout();
        showToast("Logged out successfully");
    }
});

function handleLoginSuccess(user) {
    currentUser = user;
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    userEmailDisplay.textContent = user.email;
    loadInventory();
    loadTransactions();
}

function handleLogout() {
    currentUser = null;
    appSection.classList.add('hidden');
    authSection.classList.remove('hidden');
    authForm.reset();
    if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
    }
    if (unsubscribeTransactions) {
        unsubscribeTransactions();
        unsubscribeTransactions = null;
    }
    inventoryGrid.innerHTML = '';
    transactionsList.innerHTML = '';
}

// --- Data Management (Firebase + Mock Fallback) ---
async function loadInventory() {
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    inventoryGrid.innerHTML = '';

    if (isFirebaseConfigured) {
        const q = query(collection(db, "users", currentUser.uid, "inventory"), orderBy("createdAt", "desc"));
        unsubscribeSnapshot = onSnapshot(q, (querySnapshot) => {
            inventoryData = [];
            querySnapshot.forEach((doc) => {
                inventoryData.push({ id: doc.id, ...doc.data() });
            });
            renderInventory();
        }, (error) => {
            console.error("Error fetching inventory:", error);
            showToast("Error loading items.", true);
        });
    } else {
        // Load from local storage
        const localData = localStorage.getItem(`shop_ledger_inventory_${currentUser.uid}`);
        inventoryData = localData ? JSON.parse(localData) : [];
        renderInventory();
    }
}

async function loadTransactions() {
    if (isFirebaseConfigured) {
        const q = query(collection(db, "users", currentUser.uid, "transactions"), orderBy("timestamp", "desc"));
        unsubscribeTransactions = onSnapshot(q, (querySnapshot) => {
            transactionsData = [];
            querySnapshot.forEach((doc) => {
                transactionsData.push({ id: doc.id, ...doc.data() });
            });
            if (!salesView.classList.contains('hidden')) renderTransactions();
        }, (error) => {
            console.error("Error fetching transactions:", error);
            showToast("Error loading sales history.", true);
        });
    } else {
        const localData = localStorage.getItem(`shop_ledger_transactions_${currentUser.uid}`);
        transactionsData = localData ? JSON.parse(localData) : [];
        if (!salesView.classList.contains('hidden')) renderTransactions();
    }
}

async function saveTransactionToDB(transactionData) {
    const tx = { ...transactionData, timestamp: Date.now() };
    if (isFirebaseConfigured) {
        await addDoc(collection(db, "users", currentUser.uid, "transactions"), tx);
    } else {
        const newTx = { id: Date.now().toString(), ...tx };
        transactionsData.unshift(newTx);
        localStorage.setItem(`shop_ledger_transactions_${currentUser.uid}`, JSON.stringify(transactionsData));
        if (!salesView.classList.contains('hidden')) renderTransactions();
    }
}

async function saveItemToDB(itemData) {
    if (isFirebaseConfigured) {
        await addDoc(collection(db, "users", currentUser.uid, "inventory"), {
            ...itemData,
            createdAt: serverTimestamp()
        });
    } else {
        const newItem = { id: Date.now().toString(), ...itemData, createdAt: new Date().toISOString() };
        inventoryData.unshift(newItem);
        localStorage.setItem(`shop_ledger_inventory_${currentUser.uid}`, JSON.stringify(inventoryData));
        renderInventory();
    }
}

async function updateStockInDB(itemId, newStock) {
    if (isFirebaseConfigured) {
        const itemRef = doc(db, "users", currentUser.uid, "inventory", itemId);
        await updateDoc(itemRef, { pieces: newStock });
    } else {
        const index = inventoryData.findIndex(item => item.id === itemId);
        if (index > -1) {
            inventoryData[index].pieces = newStock;
            localStorage.setItem(`shop_ledger_inventory_${currentUser.uid}`, JSON.stringify(inventoryData));
            renderInventory();
        }
    }
}

async function editItemInDB(itemId, updatedData) {
    if (isFirebaseConfigured) {
        const itemRef = doc(db, "users", currentUser.uid, "inventory", itemId);
        await updateDoc(itemRef, updatedData);
    } else {
        const index = inventoryData.findIndex(item => item.id === itemId);
        if (index > -1) {
            inventoryData[index] = { ...inventoryData[index], ...updatedData };
            localStorage.setItem(`shop_ledger_inventory_${currentUser.uid}`, JSON.stringify(inventoryData));
            renderInventory();
        }
    }
}

async function deleteItemFromDB(itemId) {
    if (isFirebaseConfigured) {
        const itemRef = doc(db, "users", currentUser.uid, "inventory", itemId);
        await deleteDoc(itemRef);
    } else {
        inventoryData = inventoryData.filter(item => item.id !== itemId);
        localStorage.setItem(`shop_ledger_inventory_${currentUser.uid}`, JSON.stringify(inventoryData));
        renderInventory();
    }
}

// --- Rendering Logic ---
function renderInventory(searchTerm = '') {
    loadingState.classList.add('hidden');
    inventoryGrid.innerHTML = '';
    
    let totalStock = 0;
    
    const filteredData = inventoryData.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.boxDetails.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Update Stats
    totalItemsCount.textContent = inventoryData.length;
    inventoryData.forEach(i => totalStock += parseInt(i.pieces) || 0);
    totalStockCount.textContent = totalStock;

    if (filteredData.length === 0) {
        if (inventoryData.length === 0) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = "No items found. Add an item to get started.";
        } else {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('p').textContent = "No items match your search.";
        }
        return;
    }
    
    emptyState.classList.add('hidden');

    filteredData.forEach(item => {
        const card = document.createElement('div');
        card.className = 'item-card';
        
        // Handle Image
        let imageHtml = '';
        if (item.picture) {
            imageHtml = `<img src="${item.picture}" alt="${item.name}" class="item-image" onerror="this.outerHTML='<div class=\\'item-image-placeholder\\'><i class=\\'fa-solid fa-image\\'></i></div>'">`;
        } else {
            imageHtml = `<div class="item-image-placeholder"><i class="fa-solid fa-box-open"></i></div>`;
        }

        let boxDisplay = item.boxDetails || '';
        if (item.piecesPerBox) {
            const boxes = Math.floor(item.pieces / item.piecesPerBox);
            const loose = item.pieces % item.piecesPerBox;
            boxDisplay = `${boxes} Box(es) @ ${item.piecesPerBox} pcs/box`;
            if (loose > 0) boxDisplay += ` + ${loose} loose pcs`;
        }

        card.innerHTML = `
            ${imageHtml}
            <div class="item-details">
                <h3 class="item-name" title="${item.name}">${item.name}</h3>
                <div class="item-meta">
                    <span><i class="fa-solid fa-cubes"></i> ${boxDisplay}</span>
                    ${item.pricePerBox ? `<span style="margin-top: 5px; display: block;"><i class="fa-solid fa-tag"></i> ₹${item.pricePerBox}/box (₹${item.pricePerPiece || (item.pricePerBox / (item.piecesPerBox || 1)).toFixed(2)}/piece)</span>` : ''}
                </div>
                <div class="item-stock">
                    <span class="stock-count">${item.pieces}</span> 
                    <span style="color: var(--text-muted); font-size: 0.9rem;">pieces available</span>
                </div>
                <div class="item-actions">
                    <button class="btn btn-outline btn-drop" data-id="${item.id}" data-name="${item.name}" data-stock="${item.pieces}">
                        <i class="fa-solid fa-minus"></i> Drop
                    </button>
                    <button class="btn btn-outline btn-edit" data-id="${item.id}" title="Edit Item">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-outline btn-delete" data-id="${item.id}" title="Delete Item">
                        <i class="fa-solid fa-trash" style="color: var(--danger)"></i>
                    </button>
                </div>
            </div>
        `;
        inventoryGrid.appendChild(card);
    });

    // Attach Action Listeners
    document.querySelectorAll('.btn-drop').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const name = e.currentTarget.getAttribute('data-name');
            const stock = e.currentTarget.getAttribute('data-stock');
            openDropModal(id, name, stock);
        });
    });

    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            openEditModal(id);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm("Are you sure you want to delete this item completely?")) {
                try {
                    await deleteItemFromDB(id);
                    showToast("Item deleted");
                } catch (error) {
                    showToast("Failed to delete item", true);
                }
            }
        });
    });
}

searchInput.addEventListener('input', (e) => {
    renderInventory(e.target.value);
});

// --- Tab Navigation Logic ---
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const targetId = btn.getAttribute('data-target');
        if (targetId === 'inventory-view') {
            inventoryView.classList.remove('hidden');
            salesView.classList.add('hidden');
        } else {
            inventoryView.classList.add('hidden');
            salesView.classList.remove('hidden');
            renderTransactions(); // Update the sales view
        }
    });
});

// --- Render Transactions ---
function renderTransactions() {
    let filteredTransactions = [...transactionsData];
    const filterType = salesFilterType.value;
    
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    let sales24hTotal = 0;
    let totalRevenue = 0;
    let totalItems = 0;
    
    // Filter
    if (filterType === 'date' && salesDateFilter.value) {
        const filterDateStr = salesDateFilter.value;
        filteredTransactions = filteredTransactions.filter(tx => {
            const txDate = new Date(tx.timestamp);
            // Format YYYY-MM-DD
            const localDateStr = new Date(txDate.getTime() - (txDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            return localDateStr === filterDateStr;
        });
    } else if (filterType === 'month' && salesMonthFilter.value) {
        const filterMonthStr = salesMonthFilter.value; 
        filteredTransactions = filteredTransactions.filter(tx => {
            const txDate = new Date(tx.timestamp);
            const localMonthStr = new Date(txDate.getTime() - (txDate.getTimezoneOffset() * 60000)).toISOString().substring(0, 7);
            return localMonthStr === filterMonthStr;
        });
    }

    transactionsList.innerHTML = '';
    
    if (filteredTransactions.length === 0) {
        salesEmptyState.classList.remove('hidden');
    } else {
        salesEmptyState.classList.add('hidden');
        filteredTransactions.forEach(tx => {
            const dateObj = new Date(tx.timestamp);
            const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            totalRevenue += tx.totalPrice || 0;
            totalItems += tx.quantity || 0;
            
            const item = document.createElement('div');
            item.className = 'transaction-item';
            item.innerHTML = `
                <div class="transaction-info">
                    <span class="transaction-name">${tx.itemName}</span>
                    <span class="transaction-meta">${tx.quantity} pcs @ ₹${tx.pricePerPiece || 0}/pc</span>
                    <span class="transaction-date">${dateStr}</span>
                </div>
                <div class="transaction-value">
                    <span class="transaction-price">+₹${(tx.totalPrice || 0).toFixed(2)}</span>
                </div>
            `;
            transactionsList.appendChild(item);
        });
    }
    
    // Always calculate 24h total from ALL transactions
    transactionsData.forEach(tx => {
        if (now - tx.timestamp <= twentyFourHours) {
            sales24hTotal += tx.totalPrice || 0;
        }
    });

    sales24h.textContent = sales24hTotal.toFixed(2);
    salesTotalRevenue.textContent = totalRevenue.toFixed(2);
    salesTotalItems.textContent = totalItems;
}

salesFilterType.addEventListener('change', (e) => {
    const val = e.target.value;
    salesDateFilter.classList.add('hidden');
    salesMonthFilter.classList.add('hidden');
    
    if (val === 'date') salesDateFilter.classList.remove('hidden');
    if (val === 'month') salesMonthFilter.classList.remove('hidden');
    
    renderTransactions();
});

salesDateFilter.addEventListener('change', renderTransactions);
salesMonthFilter.addEventListener('change', renderTransactions);

// --- Modal Logic ---

// Add Item Modal
openAddModalBtn.addEventListener('click', () => {
    currentEditItemId = null;
    document.getElementById('modal-title').textContent = "Add New Item";
    itemForm.reset();
    itemModal.classList.remove('hidden');
    itemNameInput.focus();
});

function openEditModal(id) {
    const item = inventoryData.find(i => i.id === id);
    if (!item) return;
    
    currentEditItemId = id;
    document.getElementById('modal-title').textContent = "Edit Item";
    
    itemNameInput.value = item.name;
    piecesPerBoxInput.value = item.piecesPerBox || 1;
    
    const currentBoxes = Math.floor(item.pieces / (item.piecesPerBox || 1));
    numberOfBoxesInput.value = currentBoxes;
    
    const piecePrice = item.pricePerPiece || ((item.pricePerBox || 0) / (item.piecesPerBox || 1));
    piecePriceInput.value = piecePrice > 0 ? Number(piecePrice).toFixed(2) : '';
    
    const boxPrice = item.pricePerBox || (piecePrice * (item.piecesPerBox || 1));
    boxPriceInput.value = boxPrice > 0 ? Number(boxPrice).toFixed(2) : '0';
    
    // Set pieces directly to preserve loose pieces
    itemPiecesInput.value = item.pieces;
    
    itemModal.classList.remove('hidden');
}

const calculateTotalPieces = () => {
    const pieces = parseInt(piecesPerBoxInput.value) || 0;
    const boxes = parseInt(numberOfBoxesInput.value) || 0;
    const piecePrice = parseFloat(piecePriceInput.value) || 0;
    itemPiecesInput.value = pieces * boxes;
    if (pieces > 0 && piecePrice > 0) {
        boxPriceInput.value = (piecePrice * pieces).toFixed(2);
    } else {
        boxPriceInput.value = 0;
    }
};

piecesPerBoxInput.addEventListener('input', calculateTotalPieces);
numberOfBoxesInput.addEventListener('input', calculateTotalPieces);
piecePriceInput.addEventListener('input', calculateTotalPieces);

const closeAddModal = () => {
    itemModal.classList.add('hidden');
    itemForm.reset();
    currentEditItemId = null;
};

closeModalBtn.addEventListener('click', closeAddModal);
cancelModalBtn.addEventListener('click', closeAddModal);

itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-item-btn');
    saveBtn.disabled = true;
    
    let pictureData = '';
    const file = itemPictureInput.files[0];
    if (file) {
        try {
            pictureData = await processImage(file);
        } catch (error) {
            console.error("Error processing image:", error);
            showToast("Failed to process image.", true);
            saveBtn.disabled = false;
            return;
        }
    } else if (currentEditItemId) {
        const existingItem = inventoryData.find(i => i.id === currentEditItemId);
        if (existingItem) {
            pictureData = existingItem.picture || '';
        }
    }

    const pPerBox = parseInt(piecesPerBoxInput.value) || 1;
    const pricePerBox = parseFloat(boxPriceInput.value) || 0;
    const pricePerPiece = parseFloat(piecePriceInput.value) || 0;
    const newItemData = {
        name: itemNameInput.value,
        picture: pictureData,
        pieces: parseInt(itemPiecesInput.value) || 0,
        piecesPerBox: pPerBox,
        pricePerBox: pricePerBox,
        pricePerPiece: pricePerPiece,
        boxDetails: `${pPerBox} pcs/box`
    };

    try {
        if (currentEditItemId) {
            await editItemInDB(currentEditItemId, newItemData);
            showToast("Item updated successfully!");
        } else {
            await saveItemToDB(newItemData);
            showToast("Item added successfully!");
        }
        closeAddModal();
    } catch (error) {
        console.error("Error saving item:", error);
        showToast("Failed to save item: " + error.message, true);
    } finally {
        saveBtn.disabled = false;
    }
});

// Drop Stock Modal
function openDropModal(id, name, currentStock) {
    currentDropItemId = id;
    dropItemName.textContent = name;
    dropCurrentStock.textContent = currentStock;
    dropAmountInput.max = currentStock;
    dropAmountInput.value = 1;
    dropModal.classList.remove('hidden');
    dropAmountInput.focus();
}

const closeDropModal = () => {
    dropModal.classList.add('hidden');
    dropForm.reset();
    currentDropItemId = null;
};

closeDropModalBtn.addEventListener('click', closeDropModal);
cancelDropModalBtn.addEventListener('click', closeDropModal);

dropForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dropAmount = parseInt(dropAmountInput.value);
    const currentStock = parseInt(dropCurrentStock.textContent);
    
    if (dropAmount <= 0) {
        showToast("Please enter a valid amount to drop", true);
        return;
    }
    
    if (dropAmount > currentStock) {
        showToast("Cannot drop more than current stock!", true);
        return;
    }

    const confirmBtn = document.getElementById('confirm-drop-btn');
    confirmBtn.disabled = true;

    const newStock = currentStock - dropAmount;
    
    const item = inventoryData.find(i => i.id === currentDropItemId);
    const pricePerPiece = item ? (item.pricePerPiece || 0) : 0;
    const totalPrice = pricePerPiece * dropAmount;

    try {
        await updateStockInDB(currentDropItemId, newStock);
        
        await saveTransactionToDB({
            itemId: currentDropItemId,
            itemName: dropItemName.textContent,
            quantity: dropAmount,
            pricePerPiece: pricePerPiece,
            totalPrice: totalPrice,
            type: 'sale'
        });

        showToast(`Dropped ${dropAmount} pieces successfully.`);
        closeDropModal();
    } catch (error) {
        console.error(error);
        showToast("Failed to update stock.", true);
    } finally {
        confirmBtn.disabled = false;
    }
});

// Run Init
init();
