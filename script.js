// 1. Firebase SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, serverTimestamp, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- DOM Helper Functions ---
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// --- Firebase Configuration ---
let firebaseConfig;
try {
    firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
    if (!firebaseConfig.apiKey) {
        throw new Error("Firebase config not found. Using placeholder.");
    }
} catch (e) {
    console.warn(e.message); 
    firebaseConfig = {
                apiKey: "AIzaSyCWkWLPUbgJElIb-pjytAU4qhPWWFnmPIM",
                authDomain: "rate-guru.firebaseapp.com",
                projectId: "rate-guru",
                storageBucket: "rate-guru.firebasestorage.app",
                messagingSenderId: "846627805911",
                appId: "1:846627805911:web:bff1f87aa722b05e8d6e92",
                measurementId: "G-K90ZHKT0TQ"
            };
    // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    
    if (firebaseConfig.apiKey.startsWith("AIzaSy...")) {
         setTimeout(() => alert("CRITICAL: You must paste your Firebase config into the 'catch' block in script.js!"), 0);
    } else {
        console.log("Using local fallback Firebase config. Connection will proceed.");
    }
}

// --- App ID ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-rate-app';

// --- Firebase Services ---
let app, auth, db, userId;

// --- Firestore Collection References ---
const getRatesCollection = () => collection(db, `artifacts/${appId}/public/data/rates`);
const getRateHistoryCollection = () => collection(db, `artifacts/${appId}/public/data/rateHistory`);
const getCustomersCollection = () => collection(db, `artifacts/${appId}/public/data/customers`);
const getCountriesCollection = () => collection(db, `artifacts/${appId}/public/data/countries`);
const getMotorsCollection = () => collection(db, `artifacts/${appId}/public/data/motors`);

// --- Global State ---
let currentPin = "";
const correctPin = "1234"; 
let editingRateId = null; 
let rateDataListeners = []; 
// REMOVED exchangeRates global object

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM content loaded. Initializing app...");
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
        setLogLevel('debug'); 
        console.log("Firebase services initialized.");
        authenticateUser();
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        alert("CRITICAL: Firebase failed to initialize. Check console.");
    }

    setupPinPad();
    setupNavigation();
    setupFormListeners();
});

// --- Authentication ---
async function authenticateUser() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("User is signed in:", user.uid);
            userId = user.uid;
            loadInitialData(); // Load data after user is signed in
        } else {
            console.log("User is not signed in. Authenticating...");
            try {
                const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                if (token) {
                    await signInWithCustomToken(auth, token);
                } else {
                    await signInAnonymously(auth);
                }
            } catch (error) {
                console.error("Authentication failed:", error);
                alert("Authentication failed. Data cannot be loaded.");
            }
        }
    });
}

// --- Initial Data Loading (UPDATED) ---
async function loadInitialData() {
    // REMOVED await fetchExchangeRates(); 
    
    // Now load the rest of the app data
    loadAndPopulateDatalist('customer-list', getCustomersCollection(), 'name');
    loadAndPopulateDatalist('country-list', getCountriesCollection(), 'name');
    loadAndPopulateDatalist('motor-list', getMotorsCollection(), 'name');
    listenForRates();
    listenForHistory();
}

// --- Page Navigation ---
function setupNavigation() {
    const navButtons = $$('button[data-page]');
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageId = button.getAttribute('data-page');
            showPage(pageId);
            if (button.classList.contains('sidebar-link')) {
                $$('.sidebar-link').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            }
        });
    });

    $('#logout-button').addEventListener('click', () => {
        window.location.reload();
    });
}

function showPage(pageId) {
    $$('#page-container .page').forEach(page => page.classList.add('hidden'));
    const targetPage = $(`#${pageId}`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        console.log(`Mapsd to ${pageId}`);
    } else {
        console.error(`Page not found: ${pageId}`);
    }
    if (pageId !== 'login-page') {
        $('#login-page').classList.add('hidden');
    }
}

// --- PIN Login ---
function setupPinPad() {
    $$('.keypad-button').forEach(button => {
        button.addEventListener('click', () => {
            const key = button.getAttribute('data-key');
            handlePinKey(key);
        });
    });
}

function handlePinKey(key) {
    if (key === 'C') currentPin = "";
    else if (key === 'del') currentPin = currentPin.slice(0, -1);
    else if (currentPin.length < 4) currentPin += key;
    $('#pin-display').innerText = '•'.repeat(currentPin.length);
    if (currentPin.length === 4) checkPin();
}

function checkPin() {
    if (currentPin === correctPin) {
        console.log("Login Successful!");
        $('#login-page').classList.add('hidden');
        showPage('dashboard-page');
    } else {
        console.error("Incorrect PIN");
        alert("Incorrect PIN");
        $('#pin-display').innerText = "";
        currentPin = "";
    }
}

// --- Data Population (Datalists) ---
function loadAndPopulateDatalist(datalistId, collectionRef, fieldName) {
    const datalist = $(`#${datalistId}`);
    if (!datalist) return;
    const unsub = onSnapshot(collectionRef, (snapshot) => {
        const uniqueValues = new Set();
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data[fieldName]) uniqueValues.add(data[fieldName].trim());
        });
        datalist.innerHTML = '';
        uniqueValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            datalist.appendChild(option);
        });
        const count = snapshot.size;
        if (datalistId === 'customer-list') {
            $('#stat-total-customers').textContent = count;
        } else if (datalistId === 'country-list') {
            $('#stat-total-countries').textContent = count;
        } else if (datalistId === 'motor-list') {
            $('#stat-total-motors').textContent = count;
        }
    }, (error) => console.error(`Error loading ${datalistId}:`, error));
    rateDataListeners.push(unsub);
}


// --- Rate Management Form (UPDATED) ---
function setupFormListeners() {
    $('#rate-form').addEventListener('submit', handleRateFormSubmit);
    $('#clear-form-button').addEventListener('click', clearRateForm);
    $('#filter-input').addEventListener('input', filterRateCards);
    
    // NEW: Add listeners for all manual calculation fields
    $('#rate-inr').addEventListener('input', (e) => autoCalculateCurrencies(e.target.id));
    $('#rate-usd').addEventListener('input', (e) => autoCalculateCurrencies(e.target.id));
    $('#rate-aed').addEventListener('input', (e) => autoCalculateCurrencies(e.target.id));
    $('#exchange-rate-inr').addEventListener('input', () => autoCalculateCurrencies('rate-inr')); // Recalculate from INR
    $('#exchange-rate-aed').addEventListener('input', () => autoCalculateCurrencies('rate-inr')); // Recalculate from INR
}

// REMOVED fetchExchangeRates() function

// NEW: Function to auto-calculate currencies based on manual input
function autoCalculateCurrencies(sourceId) {
    // Get all 5 values
    const exINR = parseFloat($('#exchange-rate-inr').value); // 1 USD = ? INR
    const exAED = parseFloat($('#exchange-rate-aed').value); // 1 USD = ? AED
    
    const rateINRInput = $('#rate-inr');
    const rateUSDInput = $('#rate-usd');
    const rateAEDInput = $('#rate-aed');
    
    // Check if exchange rates are valid
    if (isNaN(exINR) || exINR <= 0 || isNaN(exAED) || exAED <= 0) {
        // Can't calculate without exchange rates
        return;
    }

    // Temporarily remove listeners to prevent infinite loops
    $$('.calc-input').forEach(input => input.removeEventListener('input', autoCalculateCurrencies));

    // Calculate based on which field was changed
    switch(sourceId) {
        case 'rate-inr':
            const inr = parseFloat(rateINRInput.value);
            if (!isNaN(inr)) {
                const usd = inr / exINR;
                const aed = usd * exAED;
                rateUSDInput.value = usd.toFixed(2);
                rateAEDInput.value = aed.toFixed(2);
            }
            break;
            
        case 'rate-usd':
            const usd = parseFloat(rateUSDInput.value);
            if (!isNaN(usd)) {
                const inr = usd * exINR;
                const aed = usd * exAED;
                rateINRInput.value = inr.toFixed(2);
                rateAEDInput.value = aed.toFixed(2);
            }
            break;
            
        case 'rate-aed':
            const aed = parseFloat(rateAEDInput.value);
            if (!isNaN(aed)) {
                const usd = aed / exAED;
                const inr = usd * exINR;
                rateUSDInput.value = usd.toFixed(2);
                rateINRInput.value = inr.toFixed(2);
            }
            break;
    }

    // Re-add listeners after calculation
    $$('.calc-input').forEach(input => {
        input.addEventListener('input', (e) => autoCalculateCurrencies(e.target.id));
    });
}


async function handleRateFormSubmit(e) {
    e.preventDefault();
    
    // UPDATED: Save new fields
    const rateData = {
        customer: $('#customer').value.trim(),
        country: $('#country').value.trim(),
        motor: $('#motor').value.trim(),
        rateINR: parseFloat($('#rate-inr').value),
        rateUSD: parseFloat($('#rate-usd').value), 
        rateAED: parseFloat($('#rate-aed').value), 
        exchangeRateINR: parseFloat($('#exchange-rate-inr').value), // Save the rate
        exchangeRateAED: parseFloat($('#exchange-rate-aed').value), // Save the rate
        lastUpdated: serverTimestamp(),
        updatedBy: userId || 'unknown'
    };

    // UPDATED: Validation
    if (!rateData.customer || !rateData.country || !rateData.motor || 
        isNaN(rateData.rateINR) || isNaN(rateData.rateUSD) || isNaN(rateData.rateAED) ||
        isNaN(rateData.exchangeRateINR) || isNaN(rateData.exchangeRateAED)) {
        alert("Please fill in all fields with valid data.");
        return;
    }

    const button = $('#submit-rate-button');
    button.disabled = true;
    button.innerText = 'Saving...';
    
    try {
        await Promise.all([
            saveToHelperCollection(getCustomersCollection(), { name: rateData.customer }),
            saveToHelperCollection(getCountriesCollection(), { name: rateData.country }),
            saveToHelperCollection(getMotorsCollection(), { name: rateData.motor })
        ]);
        
        let historyAction = 'created';
        if (editingRateId) {
            const rateRef = doc(db, `artifacts/${appId}/public/data/rates`, editingRateId);
            await updateDoc(rateRef, rateData);
            historyAction = 'updated';
            alert("Rate updated successfully!");
        } else {
            await addDoc(getRatesCollection(), rateData);
            alert("Rate saved successfully!");
        }
        
        // Add all fields to history
        await addDoc(getRateHistoryCollection(), { ...rateData, action: historyAction, timestamp: serverTimestamp() });
        clearRateForm();
    } catch (error) {
        console.error("Error saving rate:", error);
        alert("Error saving rate. Please try again.");
    } finally {
        button.disabled = false;
        button.innerText = 'Save Rate';
    }
}

async function saveToHelperCollection(collectionRef, data) {
    try {
        const q = query(collectionRef, where("name", "==", data.name));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            await addDoc(collectionRef, { ...data, createdAt: serverTimestamp() });
        }
    } catch (error) {
        console.error(`Error saving helper data for ${data.name}:`, error);
    }
}

function clearRateForm() {
    $('#rate-form').reset(); // This clears all text/number inputs
    editingRateId = null;
    $('#submit-rate-button').innerText = 'Save Rate';
    $('#form-title').innerText = 'Add New Rate';
}

// --- Rate Card List (UPDATED) ---
function listenForRates() {
    const unsub = onSnapshot(getRatesCollection(), (snapshot) => {
        const rateList = $('#rate-card-list'); 
        const dashboardList = $('#dashboard-rates-list');
        
        if (!rateList || !dashboardList) return; 
        
        rateList.innerHTML = ''; 
        dashboardList.innerHTML = ''; 
 
        if (snapshot.empty) {
            const noRatesMsg = `<p class="text-gray-500 p-4">No rates found. Add one!</p>`;
            rateList.innerHTML = noRatesMsg;
            dashboardList.innerHTML = noRatesMsg; 

            // --- ANALYTICS LOGIC (for empty) ---
            $('#stat-total-rates').textContent = 0;
            $('#stat-avg-price').textContent = '$0.00';
            $('#stat-high-price').textContent = '$0.00';
            $('#stat-low-price').textContent = '$0.00';
            return;
        }

        // --- ANALYTICS LOGIC (for calculations) ---
        let totalRateValue = 0;
        let highestRate = 0;
        let lowestRate = Infinity;
        const rateCount = snapshot.size;

        snapshot.docs.forEach(doc => {
            const rate = doc.data();
            const rateId = doc.id;
            
            // --- ANALYTICS LOGIC (inside loop) ---
            const price = rate.rateUSD; // Use rateUSD
            if (!isNaN(price)) {
                totalRateValue += price;
                if (price > highestRate) highestRate = price;
                if (price < lowestRate) lowestRate = price;
            }
            // --- END LOGIC ---

            rateList.appendChild(createManagementCard(rate, rateId));
            dashboardList.appendChild(createDashboardCard(rate));
        });

        // --- ANALYTICS LOGIC (final update) ---
        const avgRate = (rateCount > 0) ? (totalRateValue / rateCount) : 0;
        $('#stat-total-rates').textContent = rateCount;
        $('#stat-avg-price').textContent = `$${avgRate.toFixed(2)}`;
        $('#stat-high-price').textContent = `$${highestRate.toFixed(2)}`;
        $('#stat-low-price').textContent = `$${(lowestRate === Infinity ? 0 : lowestRate).toFixed(2)}`;
        // --- END LOGIC ---
        
        setupRateCardButtons(); // Attach listeners
    }, (error) => console.error("Error listening for rates:", error));
    rateDataListeners.push(unsub);
}

// Helper function to create the card for the "Manage Rates" page (UPDATED)
function createManagementCard(rate, rateId) {
    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-lg shadow-md border-l-4 border-blue-500 rate-card';
    card.setAttribute('data-customer', rate.customer.toLowerCase());
    card.setAttribute('data-country', rate.country.toLowerCase());
    card.setAttribute('data-motor', rate.motor.toLowerCase());
    card.innerHTML = `
        <div class="flex justify-between items-start mb-2">
            <h3 class="text-lg font-bold text-blue-700">${rate.motor}</h3>
            <span class="text-xl font-bold text-green-600">$${rate.rateUSD ? rate.rateUSD.toFixed(2) : '0.00'}</span>
        </div>
        <div class="mb-3 space-y-1">
            <p class="text-sm text-gray-700"><strong>Customer:</strong> ${rate.customer}</p>
            <p class="text-sm text-gray-700"><strong>Country:</strong> ${rate.country}</p>
            <p class="text-sm text-gray-600"><strong>INR:</strong> ₹${rate.rateINR ? rate.rateINR.toFixed(2) : '0.00'}</p>
            <p class="text-sm text-gray-600"><strong>AED:</strong> د.إ${rate.rateAED ? rate.rateAED.toFixed(2) : '0.00'}</p>
        </div>
        <div class="flex justify-between items-center border-t border-gray-100 pt-2">
            <div class="text-xs text-gray-500">
                <strong>Updated:</strong> ${rate.lastUpdated ? new Date(rate.lastUpdated.seconds * 1000).toLocaleDateString() : 'N/A'}
            </div>
            <div class="flex space-x-2">
                <button class="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded px-2 py-1 edit-rate-btn" data-id="${rateId}">Edit</button>
                <button class="text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded px-2 py-1 delete-rate-btn" data-id="${rateId}">Delete</button>
            </div>
        </div>
    `;
    return card;
}


function setupRateCardButtons() {
    $$('.edit-rate-btn').forEach(button => {
        const newButton = button.cloneNode(true); 
        button.parentNode.replaceChild(newButton, button); 
        newButton.addEventListener('click', (e) => {
            handleEditRate(e.target.getAttribute('data-id'));
        });
    });

    $$('.delete-rate-btn').forEach(button => {
        const newButton = button.cloneNode(true); 
        button.parentNode.replaceChild(newButton, button); 
        newButton.addEventListener('click', (e) => {
            handleDeleteRate(e.target.getAttribute('data-id'));
        });
    });
}


// UPDATED: Populates all new fields
async function handleEditRate(id) {
    try {
        const rateRef = doc(db, `artifacts/${appId}/public/data/rates`, id);
        const rateSnap = await getDoc(rateRef);
        if (rateSnap.exists()) {
            const rate = rateSnap.data();
            $('#customer').value = rate.customer;
            $('#country').value = rate.country;
            $('#motor').value = rate.motor;
            $('#exchange-rate-inr').value = rate.exchangeRateINR; // Load saved rate
            $('#exchange-rate-aed').value = rate.exchangeRateAED; // Load saved rate
            $('#rate-inr').value = rate.rateINR;
            $('#rate-usd').value = rate.rateUSD;
            $('#rate-aed').value = rate.rateAED;
            
            editingRateId = id;
            $('#form-title').innerText = 'Edit Rate';
            $('#submit-rate-button').innerText = 'Update Rate';
            $('#rate-form').scrollIntoView({ behavior: 'smooth' });
        } else {
            alert("Rate not found.");
        }
    } catch (error) {
        console.error("Error fetching rate for edit:", error);
    }
}

function handleDeleteRate(id) {
    if (!confirm("Are you sure you want to delete this rate? This cannot be undone.")) {
        return;
    }
    (async () => {
        try {
            const rateRef = doc(db, `artifacts/${appId}/public/data/rates`, id);
            const rateSnap = await getDoc(rateRef);
            if (rateSnap.exists()) {
                await addDoc(getRateHistoryCollection(), { ...rateSnap.data(), action: 'deleted', timestamp: serverTimestamp(), deletedBy: userId || 'unknown' });
                await deleteDoc(rateRef);
                alert("Rate deleted.");
            }
        } catch (error) {
            console.error("Error deleting rate:", error);
        }
    })();
}

function filterRateCards(e) {
    const searchTerm = e.target.value.toLowerCase();
    $$('.rate-card').forEach(card => {
        const customer = card.getAttribute('data-customer');
        const country = card.getAttribute('data-country');
        const motor = card.getAttribute('data-motor');
        const isVisible = customer.includes(searchTerm) || country.includes(searchTerm) || motor.includes(searchTerm);
        card.style.display = isVisible ? '' : 'none';
    });
}

// --- History ---
function listenForHistory() {
    const unsub = onSnapshot(getRateHistoryCollection(), (snapshot) => {
        const historyList = $('#history-card-list');
        if (!historyList) return; 

        historyList.innerHTML = '';

        if (snapshot.empty) {
            historyList.innerHTML = `<p class="text-gray-500 p-4">No history found.</p>`;
            return;
        }

        const historyDocs = snapshot.docs;
        historyDocs.sort((a, b) => {
            const timeA = a.data().timestamp ? a.data().timestamp.seconds : 0;
            const timeB = b.data().timestamp ? b.data().timestamp.seconds : 0;
            return timeB - timeA; // Sort descending
        });

        historyDocs.forEach(doc => {
            historyList.appendChild(createHistoryCard(doc.data()));
        });

    }, (error) => console.error("Error listening for history:", error));
    rateDataListeners.push(unsub);
}

// Helper function to create dashboard cards (UPDATED)
function createDashboardCard(entry) {
    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-lg shadow-md';
    const timestamp = entry.lastUpdated ? new Date(entry.lastUpdated.seconds * 1000) : new Date();
    const date = timestamp.toLocaleDateString();
    const time = timestamp.toLocaleTimeString();

    card.innerHTML = `
        <h3 class="text-sm font-bold text-gray-800 uppercase truncate">${entry.customer}</h3>
        <p class="text-xs text-gray-500 mb-2 truncate">${entry.motor}</p>
        <div class="mb-2 space-y-1">
            <p class="text-xl font-bold text-green-600">$${entry.rateUSD ? entry.rateUSD.toFixed(2) : '0.00'}</p>
            <p class="text-xl font-bold text-blue-600">₹${entry.rateINR ? entry.rateINR.toFixed(2) : '0.00'}</p>
            <p class="text-xl font-bold text-gray-700">د.إ${entry.rateAED ? entry.rateAED.toFixed(2) : '0.00'}</p>
        </div>
        <p class="text-xs text-gray-400">by ${entry.updatedBy || 'System'}</p>
        <p class="text-xs text-gray-400">${date} ${time}</p>
    `;
    return card;
}

// Helper function to create full history cards (UPDATED)
function createHistoryCard(entry) {
    const card = document.createElement('div');
    card.className = 'bg-white p-4 rounded-lg shadow';
    let actionClass = 'text-gray-500';
    if (entry.action === 'created') actionClass = 'text-green-600 font-medium';
    if (entry.action === 'updated') actionClass = 'text-blue-600 font-medium';
    if (entry.action === 'deleted') actionClass = 'text-red-600 font-medium';
    
    card.innerHTML = `
        <div class="flex justify-between items-center mb-2">
            <h3 class="text-base font-semibold">${entry.motor}</h3>
            <span class="text-sm font-bold ${actionClass} uppercase">${entry.action}</span>
        </div>
        <p class="text-sm text-gray-700"><strong>Customer:</strong> ${entry.customer}</p>
        <p class="text-sm text-gray-700"><strong>Country:</strong> ${entry.country}</p>
        <p class="text-sm font-medium text-gray-800">Price (INR): ₹${entry.rateINR ? entry.rateINR.toFixed(2) : 'N/A'}</p>
        <p class="text-sm font-medium text-gray-800">Price (USD): $${entry.rateUSD ? entry.rateUSD.toFixed(2) : 'N/A'}</p>
        <p class="text-sm font-medium text-gray-800">Price (AED): د.إ${entry.rateAED ? entry.rateAED.toFixed(2) : 'N/A'}</p>
        <p class="text-xs text-gray-500 mt-2">Rates at time of entry: 1 USD = ${entry.exchangeRateINR} INR, 1 USD = ${entry.exchangeRateAED} AED</p>
        <div class="border-t border-gray-100 mt-3 pt-2 text-xs text-gray-500">
            <p>${entry.timestamp ? new Date(entry.timestamp.seconds * 1000).toLocaleString() : 'N/A'}</p>
            <p>User: ${entry.updatedBy || entry.deletedBy || 'N/A'}</p>
        </div>
    `;
    return card;
}
