const API_URL = 'http://127.0.0.1:8000';
let map, pickupMarker, destMarker, driverMarker;
let ws;
let selectedCab = null;
let currentToken = localStorage.getItem('token');
let currentUser = JSON.parse(localStorage.getItem('user_data'));
let mapMode = 'dropoff'; // Default mode

// Coordinates for simulation (New Delhi area)
const DELHI_LAT = 28.6139;
const DELHI_LNG = 77.2090;

// Initialize Map
function initMap() {
    map = L.map('map', {
        zoomControl: false
    }).setView([DELHI_LAT, DELHI_LNG], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // Initial Pickup Marker (Green)
    pickupMarker = L.marker([DELHI_LAT, DELHI_LNG], {
        draggable: true,
        icon: L.divIcon({
            className: 'pickup-marker',
            html: '<div style="background-color: white; border: 3px solid #000; border-radius: 50%; width: 14px; height: 14px;"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        })
    }).addTo(map);
    
    document.getElementById('pickup-input').value = `New Delhi (Current)`;

    // Initial Destination Marker (Blue)
    destMarker = L.marker([0, 0], {
        draggable: true,
        icon: L.divIcon({
            className: 'dest-marker',
            html: '<div style="background-color: #276EF1; border: 3px solid #fff; border-radius: 0; width: 14px; height: 14px;"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        })
    });

    map.on('click', (e) => {
        if (mapMode === 'pickup') {
            setPickup(e.latlng.lat, e.latlng.lng);
        } else {
            setDestination(e.latlng.lat, e.latlng.lng);
        }
    });

    pickupMarker.on('dragend', (e) => {
        const pos = pickupMarker.getLatLng();
        setPickup(pos.lat, pos.lng);
    });

    destMarker.on('dragend', (e) => {
        const pos = destMarker.getLatLng();
        setDestination(pos.lat, pos.lng);
    });
}

function setMode(mode) {
    mapMode = mode;
    document.getElementById('set-pickup-btn').classList.toggle('bg-brand-500', mode === 'pickup');
    document.getElementById('set-pickup-btn').classList.toggle('text-white', mode === 'pickup');
    document.getElementById('set-pickup-btn').classList.toggle('bg-dark-800', mode !== 'pickup');
    document.getElementById('set-pickup-btn').classList.toggle('text-gray-400', mode !== 'pickup');

    document.getElementById('set-dropoff-btn').classList.toggle('bg-brand-500', mode === 'dropoff');
    document.getElementById('set-dropoff-btn').classList.toggle('text-white', mode === 'dropoff');
    document.getElementById('set-dropoff-btn').classList.toggle('bg-dark-800', mode !== 'dropoff');
    document.getElementById('set-dropoff-btn').classList.toggle('text-gray-400', mode !== 'dropoff');
}

function setPickup(lat, lng) {
    pickupMarker.setLatLng([lat, lng]);
    document.getElementById('pickup-input').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    fetchCabs();
}

function setDestination(lat, lng) {
    if (!destMarker.getElement()) destMarker.addTo(map);
    destMarker.setLatLng([lat, lng]);
    document.getElementById('dropoff-input').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    fetchCabs();
}

// UI Helpers
function showToast(message, icon = '🚗') {
    const toast = document.getElementById('toast');
    document.getElementById('toast-message').innerText = message;
    document.getElementById('toast-icon').innerText = icon;
    toast.classList.remove('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-[-20px]', 'pointer-events-none');
    }, 4000);
}

function toggleLoginModal() {
    const modal = document.getElementById('login-modal');
    const content = document.getElementById('login-modal-content');
    modal.classList.toggle('opacity-0');
    modal.classList.toggle('pointer-events-none');
    content.classList.toggle('scale-95');
    content.classList.toggle('scale-100');
}

function toggleStatsModal() {
    const modal = document.getElementById('stats-modal');
    modal.classList.toggle('opacity-0');
    modal.classList.toggle('pointer-events-none');
    if (!modal.classList.contains('opacity-0')) fetchStats();
}

function switchTab(tab) {
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    if (tab === 'login') {
        loginTab.classList.add('border-brand-500', 'text-white');
        loginTab.classList.remove('border-transparent', 'text-gray-500');
        signupTab.classList.remove('border-brand-500', 'text-white');
        signupTab.classList.add('border-transparent', 'text-gray-500');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
    } else {
        signupTab.classList.add('border-brand-500', 'text-white');
        signupTab.classList.remove('border-transparent', 'text-gray-500');
        loginTab.classList.remove('border-brand-500', 'text-white');
        loginTab.classList.add('border-transparent', 'text-gray-500');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    }
}

function updateAuthUI() {
    if (currentToken) {
        document.getElementById('auth-section').classList.add('hidden');
        document.getElementById('user-section').classList.remove('hidden');
        document.getElementById('username-display').innerText = currentUser?.full_name || 'User';
        document.getElementById('user-avatar').src = currentUser?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.username}`;
    } else {
        document.getElementById('auth-section').classList.remove('hidden');
        document.getElementById('user-section').classList.add('hidden');
    }
}

function renderCabs(cabs) {
    const list = document.getElementById('cabs-list');
    list.innerHTML = '';
    
    cabs.forEach(cab => {
        const dest = destMarker.getLatLng();
        const pick = pickupMarker.getLatLng();
        let distance = 5;
        if (dest && dest.lat !== 0) {
            distance = pick.distanceTo(dest) / 1000;
        }
        
        const estPrice = (cab.price_per_km * distance).toFixed(0);
        const card = document.createElement('div');
        card.id = `cab-${cab.id}`;
        card.className = `ride-card border border-white/5 rounded-2xl p-4 flex items-center justify-between cursor-pointer animate-fade-in`;
        card.onclick = () => selectCab(cab.id, estPrice);
        
        let icon = '🚗';
        if (cab.type === 'Business') icon = '🚙';
        if (cab.type === 'XL') icon = '🚐';

        card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="text-3xl">${icon}</div>
                <div>
                    <p class="font-bold text-white">${cab.type}</p>
                    <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">${cab.model_name}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-bold text-lg">₹${estPrice}</p>
                <p class="text-[10px] text-brand-500 font-bold">~${(distance * 2 + 3).toFixed(0)} min</p>
            </div>
        `;
        list.appendChild(card);
    });
}

function selectCab(cabId, price) {
    selectedCab = cabId;
    document.querySelectorAll('.ride-card').forEach(card => card.classList.remove('selected'));
    const card = document.getElementById(`cab-${cabId}`);
    if (card) card.classList.add('selected');
    const bookBtn = document.getElementById('book-btn');
    bookBtn.innerText = `Book ${card.querySelector('.font-bold').innerText} • ₹${price}`;
    bookBtn.disabled = false;
}

// API Calls
async function fetchCabs() {
    try {
        const res = await fetch(`${API_URL}/cabs`);
        const cabs = await res.json();
        renderCabs(cabs);
    } catch (e) {
        showToast('Server connection failed', '❌');
    }
}

async function fetchStats() {
    try {
        const res = await fetch(`${API_URL}/stats`);
        const data = await res.json();
        document.getElementById('stat-total-users').innerText = data.total_users;
        document.getElementById('stat-total-drivers').innerText = data.total_drivers;
        document.getElementById('stat-total-bookings').innerText = data.total_bookings;
        
        const driversList = document.getElementById('drivers-list');
        driversList.innerHTML = data.active_drivers.map(d => `
            <div class="flex items-center justify-between bg-dark-800 p-3 rounded-xl">
                <div class="flex items-center gap-3">
                    <img src="${d.avatar_url}" class="w-10 h-10 rounded-full">
                    <div>
                        <p class="font-bold text-sm">${d.full_name}</p>
                        <p class="text-xs text-gray-400">⭐ ${d.rating} Rating</p>
                    </div>
                </div>
                <div class="w-2 h-2 bg-brand-500 rounded-full animate-pulse"></div>
            </div>
        `).join('');
    } catch (e) {}
}

async function login() {
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    const formData = new URLSearchParams();
    formData.append('username', user);
    formData.append('password', pass);

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData
        });
        if (res.ok) {
            const data = await res.json();
            currentToken = data.access_token;
            currentUser = { username: user, full_name: user.charAt(0).toUpperCase() + user.slice(1), avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user}` };
            localStorage.setItem('token', currentToken);
            localStorage.setItem('user_data', JSON.stringify(currentUser));
            toggleLoginModal();
            updateAuthUI();
            showToast(`Welcome back, ${currentUser.full_name}!`, '👋');
            fetchCabs();
        } else {
            showToast('Invalid credentials', '❌');
        }
    } catch (e) {
        showToast('Server error', '❌');
    }
}

async function seedDataAndLogin() {
    try {
        await fetch(`${API_URL}/seed`, { method: 'POST' });
        document.getElementById('login-username').value = 'customer1';
        document.getElementById('login-password').value = 'password';
        await login();
        fetchCabs();
    } catch (e) {
        showToast('Demo setup failed', '❌');
    }
}

async function bookRide() {
    if (!currentToken) return toggleLoginModal();
    if (!selectedCab) return;

    const promoCode = document.getElementById('promo-code-input').value.trim();
    const scheduledTime = document.getElementById('booking-date').value;
    const pick = pickupMarker.getLatLng();
    const dest = destMarker.getLatLng();

    if (!dest || dest.lat === 0) return showToast('Please set a destination', '📍');

    try {
        const res = await fetch(`${API_URL}/book`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${currentToken}`
            },
            body: JSON.stringify({
                pickup_lat: pick.lat,
                pickup_lng: pick.lng,
                dropoff_lat: dest.lat,
                dropoff_lng: dest.lng,
                promo_code: promoCode || null,
                scheduled_time: scheduledTime || null
            })
        });

        if (res.ok) {
            const booking = await res.json();
            if (booking.discount_applied > 0) {
                showToast(`Discount applied! Saved ₹${booking.discount_applied}`, '🎁');
            } else {
                showToast(scheduledTime ? 'Ride scheduled successfully!' : 'Ride confirmed!', '✅');
            }
            
            document.getElementById('book-btn').classList.add('hidden');
            document.getElementById('cab-types-container').classList.add('hidden');
            document.getElementById('promo-banner').classList.add('hidden');
            document.getElementById('promo-input-container').classList.add('hidden');
            document.getElementById('active-ride-status').classList.remove('hidden');
            
            if (!scheduledTime) startWebSocket();
        } else {
            const error = await res.json();
            showToast(error.detail || 'Booking failed', '❌');
        }
    } catch (e) {
        showToast('Booking failed', '❌');
    }
}

function startWebSocket() {
    ws = new WebSocket(`ws://localhost:8000/ws/driver-location`);
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.lat && data.lng) updateDriverMarker(data.lat, data.lng);
    };
    simulateDriverMovement();
}

function updateDriverMarker(lat, lng) {
    if (!driverMarker) {
        const icon = L.divIcon({ className: 'pulse-marker', iconSize: [16, 16] });
        driverMarker = L.marker([lat, lng], {icon}).addTo(map);
    } else {
        driverMarker.setLatLng([lat, lng]);
    }
}

function simulateDriverMovement() {
    const pick = pickupMarker.getLatLng();
    let lat = pick.lat - 0.01, lng = pick.lng - 0.01;
    const steps = 40;
    const latStep = (pick.lat - lat) / steps, lngStep = (pick.lng - lng) / steps;
    let step = 0;
    const interval = setInterval(() => {
        if (step >= steps) {
            clearInterval(interval);
            showToast('Your driver is here!', '🚗');
            return;
        }
        lat += latStep; lng += lngStep;
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ lat, lng }));
        step++;
    }, 800);
}

function logout() {
    localStorage.clear();
    location.reload();
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    updateAuthUI();
    fetchCabs();
    document.getElementById('book-btn').disabled = true;
});
