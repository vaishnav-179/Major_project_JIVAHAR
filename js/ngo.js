const API_BASE = 'http://127.0.0.1:5000/api';

let currentNgoUser = null;
let ngoMap = null;
let ngoDonationsMap = null;
let ngoMapLayers = null;
let ngoDonationsMapLayers = null;
let ngoCenterLat = 12.9784;
let ngoCenterLng = 77.6408;
let allAvailableDonations = [];
let myNgoRequests = [];
let selectedDonationForRequest = null;
let setupMap = null;
let setupMarker = null;
let selectedSetupLat = 12.9784;
let selectedSetupLng = 77.6408;
let selectedSetupAddress = "#42, Gandhi Nagar, Ballari, Karnataka";

document.addEventListener('DOMContentLoaded', () => {
    // 1. Check NGO Authentication
    const userStr = localStorage.getItem('jivahar_user');
    if (userStr) {
        try {
            const parsed = JSON.parse(userStr);
            if (parsed && (parsed.role || '').toLowerCase() === 'ngo') {
                currentNgoUser = parsed;
            }
        } catch(e) {}
    }

    if (currentNgoUser) {
        updateNgoProfileHeader();
        prefillNgoSettings();
    } else {
        // No active NGO session -> redirect to login
        window.location.href = 'login-ngo.html';
        return;
    }

    // 2. NGO Location Gate Check
    checkNgoLocationGate();

    // 3. Setup Leaflet Maps (Fixed Base Location)
    initNgoMaps();

    // 4. Load Initial NGO Dashboard Data from Flask API
    loadNgoDashboardData();

    // 5. Notification Dropdown Toggle
    const notifBtn = document.getElementById('notificationBtn');
    const notifDropdown = document.getElementById('notificationDropdown');
    if (notifBtn && notifDropdown) {
        notifBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle('active');
        });
        document.addEventListener('click', () => {
            notifDropdown.classList.remove('active');
        });
    }

    // Auto-refresh data every 15 seconds
    setInterval(loadNgoDashboardData, 15000);
});


function updateNgoProfileHeader() {
    if (!currentNgoUser) return;
    const nameEls = document.querySelectorAll('.ngo-user-name');
    nameEls.forEach(el => el.textContent = currentNgoUser.name || '');
    
    const avatarEls = document.querySelectorAll('.ngo-avatar');
    if (currentNgoUser.name) {
        avatarEls.forEach(el => el.textContent = currentNgoUser.name.charAt(0).toUpperCase());
    }
}

function prefillNgoSettings() {
    if (!currentNgoUser) return;
    const elName = document.getElementById('settingNgoName');
    const elContact = document.getElementById('settingNgoContact');
    const elEmail = document.getElementById('settingNgoEmail');
    const elPhone = document.getElementById('settingNgoPhone');
    const elAddress = document.getElementById('settingNgoAddress');
    const elRadius = document.getElementById('settingNgoRadius');

    if (elName) elName.value = currentNgoUser.name || '';
    if (elContact) elContact.value = currentNgoUser.contact_person || '';
    if (elEmail) elEmail.value = currentNgoUser.email || '';
    if (elPhone) elPhone.value = currentNgoUser.phone || '';
    if (elAddress) elAddress.value = currentNgoUser.address || '';
    if (elRadius && currentNgoUser.radius) elRadius.value = currentNgoUser.radius;
}

// ============================================
// TAB SWITCHING LOGIC
// ============================================
window.switchNgoTab = function(tabName, linkEl = null) {
    const views = {
        'dashboard': { el: document.getElementById('dashboardMainView'), title: 'Dashboard', desc: 'Find, accept and manage food donations to serve your community.' },
        'donations': { el: document.getElementById('donationsMainView'), title: 'Available Donations Stream', desc: 'Browse and request real-time surplus food offers from verified donors.' },
        'requests': { el: document.getElementById('requestsMainView'), title: 'My Pickup Requests', desc: 'Track your submitted pickup requests, scheduled couriers and receipt verifications.' },
        'reports': { el: document.getElementById('reportsMainView'), title: 'Impact & Audit Reports', desc: 'Review community meals served, food weight rescued and download verified audit PDFs.' },
        'settings': { el: document.getElementById('settingsMainView'), title: 'NGO Organization Settings', desc: 'Manage your profile, verified contacts, operational service radius and notification alerts.' }
    };

    // Update Topbar Title
    const titleH1 = document.getElementById('ngoSectionTitle');
    const descP = document.getElementById('ngoSectionDesc');

    if (views[tabName]) {
        if (titleH1) titleH1.textContent = views[tabName].title;
        if (descP) descP.textContent = views[tabName].desc;

        // Hide all views
        Object.values(views).forEach(v => {
            if (v.el) v.el.style.display = 'none';
        });

        // Show target view
        if (views[tabName].el) views[tabName].el.style.display = 'block';
    }

    // Update active sidebar link state
    if (linkEl) {
        document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
        linkEl.classList.add('active');
    }

    // Invalidate Leaflet maps on tab switch so tiles render properly
    setTimeout(() => {
        if (ngoMap) ngoMap.invalidateSize();
        if (ngoDonationsMap) ngoDonationsMap.invalidateSize();
    }, 150);
};

// ============================================
// NGO LOCATION SETUP GATE & MAPS INITIALIZATION
// ============================================
function checkNgoLocationGate() {
    if (!currentNgoUser || currentNgoUser.is_location_set !== true) {
        const modal = document.getElementById('ngoLocationSetupModal');
        if (modal) {
            modal.style.display = 'flex';
            initSetupLocationMap();
        }
    }
}

function initSetupLocationMap() {
    const initialLat = currentNgoUser?.lat || 12.9784;
    const initialLng = currentNgoUser?.lng || 77.6408;
    selectedSetupLat = initialLat;
    selectedSetupLng = initialLng;

    const container = document.getElementById('setupLocationMap');
    if (!container || typeof L === 'undefined' || setupMap) return;

    setupMap = L.map('setupLocationMap').setView([initialLat, initialLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(setupMap);

    const pinIcon = L.divIcon({
        html: '<i class="fa-solid fa-location-dot" style="color: #15803D; font-size: 32px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));"></i>',
        className: 'custom-setup-pin',
        iconSize: [32, 32],
        iconAnchor: [16, 32]
    });

    setupMarker = L.marker([initialLat, initialLng], { icon: pinIcon, draggable: true }).addTo(setupMap);

    const updateLocationFromCoords = (lat, lng) => {
        selectedSetupLat = lat;
        selectedSetupLng = lng;
        const coordsEl = document.getElementById('setupCoordsText');
        if (coordsEl) coordsEl.textContent = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

        // Reverse geocode via Nominatim
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then(res => res.json())
            .then(data => {
                if (data && data.display_name) {
                    selectedSetupAddress = data.display_name;
                    const addrEl = document.getElementById('setupSelectedAddressText');
                    if (addrEl) addrEl.textContent = selectedSetupAddress;
                }
            })
            .catch(() => {});
    };

    setupMarker.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        updateLocationFromCoords(pos.lat, pos.lng);
    });

    setupMap.on('click', (e) => {
        setupMarker.setLatLng(e.latlng);
        updateLocationFromCoords(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => setupMap.invalidateSize(), 200);

    // Auto-detect GPS location on initial setup map load
    if (navigator.geolocation && !currentNgoUser?.is_location_set) {
        useCurrentGpsLocationForSetup();
    }
}

window.useCurrentGpsLocationForSetup = function() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    const btn = document.querySelector('button[onclick="useCurrentGpsLocationForSetup()"]');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating GPS...';
    }

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            selectedSetupLat = lat;
            selectedSetupLng = lng;

            if (setupMap && setupMarker) {
                setupMap.setView([lat, lng], 15);
                setupMarker.setLatLng([lat, lng]);
            }

            const coordsEl = document.getElementById('setupCoordsText');
            if (coordsEl) coordsEl.textContent = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;

            // Reverse geocode GPS location
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data.display_name) {
                        selectedSetupAddress = data.display_name;
                        const addrEl = document.getElementById('setupSelectedAddressText');
                        if (addrEl) addrEl.textContent = selectedSetupAddress;
                        
                        const searchInput = document.getElementById('setupSearchInput');
                        if (searchInput) searchInput.value = selectedSetupAddress;
                    }
                })
                .catch(() => {})
                .finally(() => {
                    if (btn) {
                        btn.disabled = false;
                        btn.innerHTML = originalText;
                    }
                });
        },
        (err) => {
            console.warn("GPS location failed:", err);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
};

window.searchSetupAddress = function() {
    const input = document.getElementById('setupSearchInput');
    if (!input || !input.value.trim()) return;
    const query = encodeURIComponent(input.value.trim());

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);

                selectedSetupLat = lat;
                selectedSetupLng = lon;
                selectedSetupAddress = result.display_name;

                if (setupMap && setupMarker) {
                    setupMap.setView([lat, lon], 14);
                    setupMarker.setLatLng([lat, lon]);
                }

                const addrEl = document.getElementById('setupSelectedAddressText');
                const coordsEl = document.getElementById('setupCoordsText');
                if (addrEl) addrEl.textContent = selectedSetupAddress;
                if (coordsEl) coordsEl.textContent = `Lat: ${lat.toFixed(5)}, Lng: ${lon.toFixed(5)}`;
            } else {
                alert("Address location not found. Try entering city name or landmark.");
            }
        })
        .catch(err => console.error("Geocoding error:", err));
};

window.confirmNgoLocationSetup = function() {
    if (!currentNgoUser || !currentNgoUser._id) {
        alert("Session expired. Please log in again.");
        return;
    }

    const btn = document.getElementById('btnConfirmSetupLocation');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving Base Location...';
    }

    fetch(`${API_BASE}/auth/set-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            user_id: currentNgoUser._id,
            lat: selectedSetupLat,
            lng: selectedSetupLng,
            address: selectedSetupAddress
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            currentNgoUser.lat = selectedSetupLat;
            currentNgoUser.lng = selectedSetupLng;
            currentNgoUser.address = selectedSetupAddress;
            currentNgoUser.is_location_set = true;

            localStorage.setItem('jivahar_user', JSON.stringify(currentNgoUser));

            const modal = document.getElementById('ngoLocationSetupModal');
            if (modal) modal.style.display = 'none';

            // Re-initialize fixed maps
            initNgoMaps();
            loadNgoDashboardData();
            alert("✅ Base Location Confirmed! Full NGO operations unlocked.");
        } else {
            alert(`Error setting location: ${data.message}`);
        }
    })
    .catch(err => {
        // Fallback local update
        currentNgoUser.lat = selectedSetupLat;
        currentNgoUser.lng = selectedSetupLng;
        currentNgoUser.address = selectedSetupAddress;
        currentNgoUser.is_location_set = true;

        localStorage.setItem('jivahar_user', JSON.stringify(currentNgoUser));

        const modal = document.getElementById('ngoLocationSetupModal');
        if (modal) modal.style.display = 'none';

        initNgoMaps();
        loadNgoDashboardData();
        alert("✅ Base Location Saved! Full NGO operations unlocked.");
    })
    .finally(() => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Confirm Base Location & Unlock Operations';
        }
    });
};

function initNgoMaps() {
    // FIXED NGO BASE LOCATION (Configured initially by NGO - does not change with live geolocation)
    ngoCenterLat = currentNgoUser?.lat || 12.9784;
    ngoCenterLng = currentNgoUser?.lng || 77.6408;

    // 1. Dashboard Mini Map
    const mapContainer = document.getElementById('ngoMap');
    if (mapContainer && typeof L !== 'undefined' && !ngoMap) {
        ngoMap = L.map('ngoMap').setView([ngoCenterLat, ngoCenterLng], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(ngoMap);

        ngoMapLayers = L.layerGroup().addTo(ngoMap);
        enableInteractiveMapClickRouting(ngoMap, ngoMapLayers);
    } else if (ngoMap) {
        ngoMap.setView([ngoCenterLat, ngoCenterLng], 12);
    }

    // 2. Full Donations Radar Map
    const donMapContainer = document.getElementById('ngoMapDonations');
    if (donMapContainer && typeof L !== 'undefined' && !ngoDonationsMap) {
        ngoDonationsMap = L.map('ngoMapDonations').setView([ngoCenterLat, ngoCenterLng], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(ngoDonationsMap);

        ngoDonationsMapLayers = L.layerGroup().addTo(ngoDonationsMap);
        enableInteractiveMapClickRouting(ngoDonationsMap, ngoDonationsMapLayers);
    } else if (ngoDonationsMap) {
        ngoDonationsMap.setView([ngoCenterLat, ngoCenterLng], 12);
    }
}


// Helper to lock donor coordinates to a fixed, unmoving point
function ensureFixedDonationCoordinates(donation) {
    if (!donation) return;
    if (!donation.pickup_details) donation.pickup_details = {};

    // Keep existing explicit coordinates if present
    if (donation.pickup_details.lat && donation.pickup_details.lng) {
        return;
    }

    // Deterministic hash based on donation ID to lock pin position permanently
    const seed = String(donation._id || donation.id || donation.title || 'don_default');
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }

    const baseLat = currentNgoUser?.lat || 12.9784;
    const baseLng = currentNgoUser?.lng || 77.6408;

    const norm1 = (Math.abs(hash) % 1000) / 1000;
    const norm2 = (Math.abs(hash >> 3) % 1000) / 1000;

    // Fixed offsets between 1km and 4km from NGO base
    const offsetLat = (norm1 * 0.05) - 0.025;
    const offsetLng = (norm2 * 0.05) - 0.025;

    donation.pickup_details.lat = Number((baseLat + offsetLat).toFixed(5));
    donation.pickup_details.lng = Number((baseLng + offsetLng).toFixed(5));
}

// ============================================
// DATA FETCHING & RENDERING
// ============================================
// Local cache of rejected donation IDs for current NGO
let savedNgoRejected = [];
try {
    savedNgoRejected = JSON.parse(localStorage.getItem('jivahar_ngo_rejected_donations') || '[]');
} catch(e) {}
window.localNgoRejectedDonations = new Set(savedNgoRejected);

function isDonationRejectedByNgo(d) {
    if (!d) return false;
    const ngoId = currentNgoUser?._id ? String(currentNgoUser._id) : '';
    const donId = String(d._id);
    if (window.localNgoRejectedDonations && window.localNgoRejectedDonations.has(donId)) {
        return true;
    }
    if (ngoId && Array.isArray(d.rejected_by) && d.rejected_by.some(r => String(r) === ngoId)) {
        return true;
    }
    if (ngoId && d.notification_cascade && Array.isArray(d.notification_cascade.history)) {
        if (d.notification_cascade.history.some(h => h.action === 'ngo_rejected' && String(h.ngo_id) === ngoId)) {
            return true;
        }
    }
    return false;
}

function loadNgoDashboardData() {
    const ngoId = currentNgoUser?._id || '';
    const url = ngoId ? `${API_BASE}/donations/all?ngo_id=${encodeURIComponent(ngoId)}` : `${API_BASE}/donations/all`;
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.donations) {
                // Filter out any donations that have been passed/rejected by this NGO
                allAvailableDonations = data.donations.filter(d => !isDonationRejectedByNgo(d));
                allAvailableDonations.forEach(ensureFixedDonationCoordinates);

                renderIncomingNotifications(allAvailableDonations);
                renderAvailableDonationsList(allAvailableDonations);
                updateNgoMapMarkers(allAvailableDonations);
                updateNgoMetrics(allAvailableDonations);
            }
        })
        .catch(err => console.error("Error fetching donations for NGO:", err));
}

// Calculate distance using Haversine formula
function getDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 2.5; // Default fallback
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Render Incoming Notifications Assigned to this NGO
function renderIncomingNotifications(donations) {
    const listContainer = document.getElementById('incomingNotificationsList');
    const badgeEl = document.getElementById('incomingBadgeCount');
    if (!listContainer) return;

    // Filter donations where status is Pending and not passed/rejected by this NGO
    const pendingIncoming = donations.filter(d => d.status === 'Pending' && !isDonationRejectedByNgo(d));

    if (badgeEl) badgeEl.textContent = `${pendingIncoming.length} Pending`;

    if (pendingIncoming.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding:16px; color:#64748B; font-size:13px;">No pending incoming donation alerts at the moment. All caught up!</div>`;
        return;
    }

    listContainer.innerHTML = pendingIncoming.map(donation => {
        const firstItem = (donation.items && donation.items.length > 0) ? donation.items[0] : { name: "Food Items", category: "Cooked Food" };
        const totalItems = donation.items ? donation.items.length : 1;
        let totalQty = 0;
        let qtyUnit = 'kg';
        if (donation.items) {
            donation.items.forEach(i => totalQty += Number(i.quantity || 0));
            qtyUnit = donation.items[0]?.unit || 'kg';
        }

        const donorLat = donation.pickup_details?.lat || 12.9716;
        const donorLng = donation.pickup_details?.lng || 77.5946;
        const ngoLat = currentNgoUser?.lat || 12.9784;
        const ngoLng = currentNgoUser?.lng || 77.6408;

        const distKm = getDistanceKm(ngoLat, ngoLng, donorLat, donorLng).toFixed(1);

        const cascade = donation.notification_cascade || {};
        const tier = cascade.active_tier || 1;
        const radius = cascade.active_radius || (tier === 1 ? '15 km' : '25 km');

        return `
            <div class="incoming-card">
                <div class="incoming-left">
                    <div class="incoming-icon">
                        <i class="fa-solid fa-bell-concierge"></i>
                    </div>
                    <div class="incoming-info">
                        <h4>${firstItem.name} ${totalItems > 1 ? `+${totalItems-1} more` : ''} (${totalQty} ${qtyUnit})</h4>
                        <p>📍 Pickup Address: <strong>${donation.pickup_details?.address || 'Local Donor Address'}</strong></p>
                        <div class="incoming-pills">
                            <span class="tag-pill" style="background:#DCFCE7; color:#166534; padding:2px 8px; border-radius:4px; font-weight:700;">📍 ${distKm} km away</span>
                            <span class="tag-pill" style="background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:4px; font-weight:700;">⚡ Tier ${tier} (${radius})</span>
                            <span class="tag-pill" style="background:#FEF3C7; color:#B45309; padding:2px 8px; border-radius:4px; font-weight:700;">⏱️ Priority Notification</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; gap:10px; flex-shrink:0;">
                    <button class="btn-decision-reject" onclick="openDecisionRejectModal('${donation._id}', '${firstItem.name}', '${totalQty} ${qtyUnit}', '${donation.pickup_details?.address || 'Donor Address'}')"><i class="fa-solid fa-xmark"></i> Pass / Reject</button>
                    <button class="btn-decision-accept" onclick="handleAcceptDonation('${donation._id}')"><i class="fa-solid fa-check"></i> Accept Donation</button>
                </div>
            </div>
        `;
    }).join('');
}

// Render Available Donations Stream
function renderAvailableDonationsList(donations) {
    const streamContainer = document.getElementById('fullDonationsList');
    const dashboardContainer = document.querySelector('.donations-list');

    const available = donations.filter(d => (d.status === 'Pending' || d.status === 'Accepted') && !isDonationRejectedByNgo(d));

    const renderCardHtml = (donation) => {
        const firstItem = (donation.items && donation.items.length > 0) ? donation.items[0] : { name: "Food Package", category: "Cooked" };
        let totalQty = 0;
        let qtyUnit = 'kg';
        if (donation.items) {
            donation.items.forEach(i => totalQty += Number(i.quantity || 0));
            qtyUnit = donation.items[0]?.unit || 'kg';
        }

        let imgUrl = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80";
        if (firstItem.photo) imgUrl = firstItem.photo;
        else if (firstItem.name.toLowerCase().includes('biryani') || firstItem.name.toLowerCase().includes('rice')) {
            imgUrl = "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80";
        } else if (firstItem.name.toLowerCase().includes('fruit')) {
            imgUrl = "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=300&auto=format&fit=crop&q=80";
        } else if (firstItem.name.toLowerCase().includes('bread') || firstItem.name.toLowerCase().includes('sweet')) {
            imgUrl = "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=80";
        }

        const donorLat = donation.pickup_details?.lat || 12.9716;
        const donorLng = donation.pickup_details?.lng || 77.5946;
        const ngoLat = currentNgoUser?.lat || 12.9784;
        const ngoLng = currentNgoUser?.lng || 77.6408;

        const distKm = getDistanceKm(ngoLat, ngoLng, donorLat, donorLng).toFixed(1);

        const isAccepted = donation.status === 'Accepted';
        const buttonHtml = isAccepted 
            ? `<button class="btn-request-pickup" style="background:#0284C7; cursor:default;"><i class="fa-solid fa-circle-check"></i> Accepted</button>`
            : `<button class="btn-request-pickup" onclick="handleAcceptDonation('${donation._id}')">Accept Pickup</button>`;

        return `
            <div class="donation-item-card" data-category="${firstItem.category?.toLowerCase() || 'veg'}">
                <div class="donation-left">
                    <img src="${imgUrl}" alt="${firstItem.name}" class="donation-img">
                    <div class="donation-meta">
                        <h4>${firstItem.name}</h4>
                        <p>${firstItem.category || 'Food Item'} • Contact: ${donation.pickup_details?.contact_name || 'Verified Donor'}</p>
                        <div class="donation-location">
                            <i class="fa-solid fa-location-dot" style="color: #15803D;"></i> ${donation.pickup_details?.address || 'Ballari Service Location'}
                        </div>
                    </div>
                </div>
                <div class="donation-right">
                    <div class="donation-qty">${totalQty} ${qtyUnit}</div>
                    <div class="donation-pills">
                        <span class="tag-pill tag-time" style="color: #D97706;"><i class="fa-regular fa-clock"></i> Available Now</span>
                        <span class="tag-pill tag-dist"><i class="fa-solid fa-route"></i> ${distKm} km</span>
                    </div>
                    ${buttonHtml}
                </div>
            </div>
        `;
    };

    if (streamContainer) {
        if (available.length === 0) {
            streamContainer.innerHTML = `<p style="text-align:center; padding:20px; color:#94A3B8;">No active donations in stream right now.</p>`;
        } else {
            streamContainer.innerHTML = available.map(renderCardHtml).join('');
        }
    }

    if (dashboardContainer) {
        if (available.length > 0) {
            dashboardContainer.innerHTML = available.slice(0, 4).map(renderCardHtml).join('');
        }
    }

    // Also update Requests table
    renderNgoRequestsTable(donations);
}

// Update Leaflet Map Markers with Real Donation Data & Concentric Tier Circles
function updateNgoMapMarkers(donations) {
    if (!ngoMapLayers && !ngoDonationsMapLayers) return;

    // Clear previous markers & circles cleanly
    if (ngoMapLayers) ngoMapLayers.clearLayers();
    if (ngoDonationsMapLayers) ngoDonationsMapLayers.clearLayers();

    // 1. Live Location Marker Icon (Pulsing Blue Dot - exact match with Donor Map)
    const liveIcon = L.divIcon({
        html: `
            <div style="position:relative; width:20px; height:20px; display:flex; align-items:center; justify-content:center;">
                <div style="position:absolute; width:24px; height:24px; background:rgba(37, 99, 235, 0.4); border-radius:50%; animation: pulse-ring 2s infinite;"></div>
                <div style="width:14px; height:14px; background:#2563eb; border:2.5px solid #ffffff; border-radius:50%; box-shadow:0 2px 6px rgba(0,0,0,0.35); z-index:2;"></div>
            </div>
        `,
        className: 'custom-live-blue-dot',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
    });

    // 2. Add Live Center Markers & Concentric Circles on both maps
    const centerPopup = `
        <div style="padding:4px; font-family:'Plus Jakarta Sans', sans-serif;">
            <div style="display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-building-ngo" style="color:#2563eb; font-size:16px;"></i>
                <strong style="font-size:13px; color:#0f172a;">${currentNgoUser?.name || 'Your NGO Center'}</strong>
            </div>
            <div style="font-size:11px; color:#16a34a; font-weight:600; margin-top:2px;">✓ Verified Service Center</div>
            <div style="font-size:11px; color:#64748b;">📍 ${currentNgoUser?.address || 'Service Location'}</div>
        </div>
    `;

    const addCenterAndCirclesToMap = (layerGroup) => {
        if (!layerGroup) return;

        // Add NGO Permanent Established Location Marker (Building Icon)
        L.marker([ngoCenterLat, ngoCenterLng], { icon: MapIcons.createNgoMarker(currentNgoUser?.name || 'Your NGO Base') })
         .addTo(layerGroup)
         .bindPopup(centerPopup);

        // Tier 1 Priority Circle (15 km - Emerald Green)
        L.circle([ngoCenterLat, ngoCenterLng], {
            radius: 15000,
            color: '#10b981',
            fillColor: '#10b981',
            fillOpacity: 0.08,
            weight: 1.5,
            dashArray: '4, 4'
        }).addTo(layerGroup).bindTooltip("⚡ Tier 1: Priority Zone (15 km)", { permanent: false });

        // Tier 2 Cascade Circle (25 km - Amber Orange)
        L.circle([ngoCenterLat, ngoCenterLng], {
            radius: 25000,
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.04,
            weight: 1.5,
            dashArray: '5, 5'
        }).addTo(layerGroup).bindTooltip("⏱️ Tier 2: Cascade Zone (25 km)", { permanent: false });
    };

    addCenterAndCirclesToMap(ngoMapLayers);
    addCenterAndCirclesToMap(ngoDonationsMapLayers);

    // 3. Render Dynamic Donor Specific Pickup Location Markers
    donations.forEach(don => {
        ensureFixedDonationCoordinates(don);
        const donLat = don.pickup_location?.latitude || don.pickup_details?.lat;
        const donLng = don.pickup_location?.longitude || don.pickup_details?.lng;
        const pickupAddr = don.pickup_location?.address || don.pickup_details?.address || 'Pickup Point';

        const distKm = getDistanceKm(ngoCenterLat, ngoCenterLng, donLat, donLng);

        let tierBadge = '';
        if (distKm <= 15) {
            tierBadge = `<span style="display:inline-block; padding:2px 6px; font-size:10px; font-weight:700; background:#e6f4ea; color:#137333; border-radius:4px;">⚡ Tier 1 Priority (15km)</span>`;
        } else if (distKm <= 25) {
            tierBadge = `<span style="display:inline-block; padding:2px 6px; font-size:10px; font-weight:700; background:#fef7e0; color:#b06000; border-radius:4px;">⏱️ Tier 2 Cascade (25km)</span>`;
        } else {
            tierBadge = `<span style="display:inline-block; padding:2px 6px; font-size:10px; font-weight:700; background:#f1f5f9; color:#475569; border-radius:4px;">📍 Zone Radius (${distKm.toFixed(1)}km)</span>`;
        }

        const firstItem = (don.items && don.items.length > 0) ? don.items[0] : { name: "Food Package", category: "Cooked Food" };
        let totalQty = 0;
        let qtyUnit = 'kg';
        if (don.items) {
            don.items.forEach(i => totalQty += Number(i.quantity || 0));
            qtyUnit = don.items[0]?.unit || 'kg';
        }

        const foodPinIcon = MapIcons.createPickupMarker(firstItem.category);

        const popupCardHtml = `
            <div style="padding:6px; min-width:220px; font-family:'Plus Jakarta Sans', sans-serif;">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <div style="width:34px; height:34px; border-radius:10px; background:#dcfce7; color:#15803d; display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0;">
                        <i class="fa-solid fa-box-archive"></i>
                    </div>
                    <div>
                        <strong style="font-size:13px; color:#0f172a; display:block; line-height:1.2;">${firstItem.name}</strong>
                        <span style="font-size:11px; color:#64748b;">Donor: ${don.pickup_details?.contact_name || 'Verified Donor'}</span>
                    </div>
                </div>
                <div style="font-size:12px; font-weight:700; color:#15803d; margin-bottom:4px;">
                    📦 Quantity: ${totalQty} ${qtyUnit}
                </div>
                <div style="font-size:11px; color:#475569; margin-bottom:4px; line-height:1.3;">
                    📍 ${pickupAddr}<br>
                    <strong>${distKm.toFixed(1)} km from NGO Base</strong>
                </div>
                <div style="margin-bottom:8px;">${tierBadge}</div>
                ${don.pickup_details?.contact_phone ? `<div style="font-size:11px; color:#2563eb; margin-bottom:8px;"><i class="fa-solid fa-phone"></i> ${don.pickup_details.contact_phone}</div>` : ''}
                ${don.status === 'Accepted' || don.status === 'Picked Up' || don.status === 'In Transit' ? `
                    <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
                        <span style="display:block; text-align:center; padding:4px; font-size:11px; background:#e0f2fe; color:#0369a1; font-weight:700; border-radius:4px;">✓ Status: ${don.status}</span>
                        <button class="btn btn-primary" style="width:100%; padding:6px 12px; font-size:12px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-weight:700; cursor:pointer;" onclick="RouteMap.openExternalNavigation(${ngoCenterLat}, ${ngoCenterLng}, ${donLat}, ${donLng})">
                            <i class="fa-solid fa-diamond-turn-right"></i> Start Navigation
                        </button>
                    </div>
                ` : `
                    <button class="btn btn-primary" style="width:100%; padding:6px 12px; font-size:12px; background:#15803d; color:#fff; border:none; border-radius:6px; font-weight:700; cursor:pointer;" onclick="handleAcceptDonation('${don._id}')">
                        <i class="fa-solid fa-check"></i> Accept Donation
                    </button>
                `}
            </div>
        `;

        if (ngoMapLayers) {
            L.marker([donLat, donLng], { icon: foodPinIcon }).addTo(ngoMapLayers).bindPopup(popupCardHtml);
        }
        if (ngoDonationsMapLayers) {
            L.marker([donLat, donLng], { icon: foodPinIcon }).addTo(ngoDonationsMapLayers).bindPopup(popupCardHtml);
        }

        // 4. Draw Shortest Volunteer Route for Accepted Donations
        if (don.status === 'Accepted' || don.status === 'Picked Up' || don.status === 'In Transit') {
            const firstItemName = firstItem.name || 'Food Donation';
            if (ngoMapLayers && ngoMap) {
                fetchAndDrawVolunteerRoute(ngoMap, ngoMapLayers, donLat, donLng, ngoCenterLat, ngoCenterLng, `Pickup: ${firstItemName}`);
            }
            if (ngoDonationsMapLayers && ngoDonationsMap) {
                fetchAndDrawVolunteerRoute(ngoDonationsMap, ngoDonationsMapLayers, donLat, donLng, ngoCenterLat, ngoCenterLng, `Pickup: ${firstItemName}`);
            }
        }
    });
}

let activeRiderTimers = [];
let currentInteractivePin = null;
let currentInteractiveRouteLayer = null;

// Enable Click-to-Place / Drag Green Donor Pin & Find Shortest Route to NGO
function enableInteractiveMapClickRouting(mapInstance, layerGroup) {
    if (!mapInstance) return;

    mapInstance.on('click', function(e) {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;

        if (currentInteractivePin && layerGroup.hasLayer(currentInteractivePin)) {
            layerGroup.removeLayer(currentInteractivePin);
        }
        if (currentInteractiveRouteLayer && layerGroup.hasLayer(currentInteractiveRouteLayer)) {
            layerGroup.removeLayer(currentInteractiveRouteLayer);
        }

        const foodPinIcon = L.divIcon({
            html: `
                <div style="position:relative; width:40px; height:40px; display:flex; align-items:center; justify-content:center;">
                    <div style="position:absolute; width:40px; height:40px; background:rgba(22, 163, 74, 0.45); border-radius:50%; animation: pulse-ring 1.8s infinite;"></div>
                    <div style="width:40px; height:40px; background:linear-gradient(135deg, #16A34A 0%, #15803D 100%); border:3px solid #FFFFFF; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 8px 20px rgba(22,163,74,0.5); z-index:10;">
                        <i class="fa-solid fa-location-dot" style="color:#FFFFFF; font-size:18px; transform:rotate(45deg);"></i>
                    </div>
                </div>
            `,
            className: 'custom-interactive-food-pin',
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40]
        });

        currentInteractivePin = L.marker([lat, lng], { icon: foodPinIcon, draggable: true })
            .addTo(layerGroup)
            .bindPopup(`
                <div style="padding:6px; font-family:'Plus Jakarta Sans', sans-serif;">
                    <div style="font-weight:700; color:#15803d; font-size:13px;">📍 Placed Donor Location</div>
                    <div style="font-size:11px; color:#64748b;">Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}</div>
                    <div style="font-size:11px; color:#16a34a; font-weight:700; margin-top:4px;">🚀 Tracing shortest route to NGO...</div>
                </div>
            `)
            .openPopup();

        currentInteractivePin.on('dragend', function(evt) {
            const newPos = evt.target.getLatLng();
            mapInstance.fire('click', { latlng: newPos });
        });

        fetchAndDrawVolunteerRoute(mapInstance, layerGroup, lat, lng, ngoCenterLat, ngoCenterLng, 'Placed Donor Pickup Route', true);
    });
}

// Fetch & Draw Shortest Volunteer Route (OSRM API + Polyline Tooltip + Moving Vehicle Animation)
function fetchAndDrawVolunteerRoute(mapInstance, layerGroup, startLat, startLng, endLat, endLng, routeLabel = 'Volunteer Route', animateRider = true) {
    if (!mapInstance || !layerGroup || !startLat || !startLng || !endLat || !endLng) return;

    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
        .then(res => res.json())
        .then(data => {
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
                const distanceKm = (route.distance / 1000).toFixed(1);
                const durationMins = Math.round(route.duration / 60);

                const routeLine = L.polyline(coords, {
                    color: '#16a34a',
                    weight: 6,
                    opacity: 0.9,
                    dashArray: '8, 8'
                }).addTo(layerGroup);
                currentInteractiveRouteLayer = routeLine;

                routeLine.bindTooltip(`🛣️ ${routeLabel} • Shortest Route (${distanceKm} km, ~${durationMins} mins)`, { permanent: true, sticky: true });

                if (animateRider && coords.length > 1) {
                    const riderIcon = L.divIcon({
                        html: `
                            <div style="position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center;">
                                <div style="position:absolute; width:34px; height:34px; background:rgba(37, 99, 235, 0.4); border-radius:50%; animation: pulse-ring 1.5s infinite;"></div>
                                <div style="width:34px; height:34px; background:linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%); border:2.5px solid #FFFFFF; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(37,99,235,0.45); z-index:10;">
                                    <i class="fa-solid fa-motorcycle" style="color:#FFFFFF; font-size:16px;"></i>
                                </div>
                            </div>
                        `,
                        className: 'custom-interactive-rider-pin',
                        iconSize: [34, 34],
                        iconAnchor: [17, 17]
                    });

                    let stepIdx = 0;
                    const riderMarker = L.marker(coords[0], { icon: riderIcon }).addTo(layerGroup);
                    const timerId = setInterval(() => {
                        stepIdx++;
                        if (stepIdx >= coords.length) {
                            stepIdx = 0;
                        }
                        riderMarker.setLatLng(coords[stepIdx]);
                    }, 180);
                    activeRiderTimers.push(timerId);
                }
            } else {
                drawFallbackPolyline();
            }
        })
        .catch(() => drawFallbackPolyline());

    function drawFallbackPolyline() {
        const coords = [[startLat, startLng], [endLat, endLng]];
        const routeLine = L.polyline(coords, {
            color: '#16a34a',
            weight: 4,
            opacity: 0.8,
            dashArray: '6, 6'
        }).addTo(layerGroup);
        currentInteractiveRouteLayer = routeLine;
        routeLine.bindTooltip(`🛣️ ${routeLabel} (Shortest Direct Route)`, { permanent: false });
    }
}



// Update Top Metric Cards & Impact Reports Tab Metrics
function updateNgoMetrics(donations) {
    let totalAvailable = 0;
    let totalAccepted = 0;
    let totalKg = 0;
    const uniqueDonorsSet = new Set();

    donations.forEach(d => {
        if (d.status === 'Pending') totalAvailable++;
        if (d.status === 'Accepted' || d.status === 'Picked Up' || d.status === 'Delivered') {
            totalAccepted++;
            if (d.items) {
                d.items.forEach(item => totalKg += Number(item.quantity || 0));
            }
            if (d.donor_id) uniqueDonorsSet.add(d.donor_id);
            else if (d.pickup_details?.contact_name) uniqueDonorsSet.add(d.pickup_details.contact_name);
        }
    });

    const peopleServed = totalKg * 4;
    const co2Offset = (totalKg * 2.5).toFixed(1);
    const totalDonors = uniqueDonorsSet.size || (totalAccepted > 0 ? totalAccepted : 0);

    // 1. Overview Top Metric Cards
    const valAvailable = document.getElementById('overviewAvailableFood');
    const valAccepted = document.getElementById('overviewAcceptedPickups');
    const valKg = document.getElementById('overviewRescuedWeight');
    const valPeople = document.getElementById('overviewCommunityImpact');

    if (valAvailable) valAvailable.textContent = totalAvailable;
    if (valAccepted) valAccepted.textContent = totalAccepted;
    if (valKg) valKg.textContent = `${totalKg} kg`;
    if (valPeople) valPeople.textContent = peopleServed.toLocaleString();

    // 2. Impact & Reports Tab View Metrics
    const rPeople = document.getElementById('reportPeopleServed');
    const rRescued = document.getElementById('reportFoodRescued');
    const rCo2 = document.getElementById('reportCo2Offset');
    const rDonors = document.getElementById('reportPartnerDonors');

    if (rPeople) rPeople.textContent = peopleServed > 0 ? peopleServed.toLocaleString() : '0';
    if (rRescued) rRescued.textContent = `${totalKg} kg`;
    if (rCo2) rCo2.textContent = `${co2Offset} kg`;
    if (rDonors) rDonors.textContent = totalDonors;

    // 3. Render Dynamic Impact Reports Table
    renderImpactReportsTable(donations);
}

// Render Dynamic Generated Impact Reports Table
function renderImpactReportsTable(donations) {
    const tbody = document.getElementById('impactReportsBody');
    if (!tbody) return;

    const accepted = donations.filter(d => d.status === 'Accepted' || d.status === 'Picked Up' || d.status === 'Delivered');

    if (accepted.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #94A3B8; padding: 24px;">
                    <div style="font-size: 14px; font-weight: 600; color: #64748B;">No Accepted Claims Yet for Audit Reports</div>
                    <div style="font-size: 12px; margin-top: 4px;">Accept incoming food offers to automatically generate monthly impact audit reports.</div>
                </td>
            </tr>
        `;
        return;
    }

    // Group accepted claims by Month-Year
    const monthGroups = {};
    accepted.forEach(d => {
        let dateObj = new Date();
        if (d.created_at) {
            dateObj = new Date(d.created_at);
        } else if (d.pickup_details?.date) {
            dateObj = new Date(d.pickup_details.date);
        }
        const monthYear = dateObj.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        
        if (!monthGroups[monthYear]) {
            monthGroups[monthYear] = {
                period: monthYear,
                totalKg: 0,
                donors: new Set(),
                count: 0
            };
        }

        let itemKg = 0;
        if (d.items) d.items.forEach(i => itemKg += Number(i.quantity || 0));
        monthGroups[monthYear].totalKg += itemKg;
        monthGroups[monthYear].count++;
        if (d.donor_id) monthGroups[monthYear].donors.add(d.donor_id);
        else if (d.pickup_details?.contact_name) monthGroups[monthYear].donors.add(d.pickup_details.contact_name);
    });

    const rowsHtml = Object.values(monthGroups).map(group => {
        const meals = group.totalKg * 4;
        const donorCount = group.donors.size || group.count;
        const genDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        return `
            <tr>
                <td style="font-weight: 700; color: #0F172A;">${group.period} Report (Live)</td>
                <td><strong style="color:#15803D;">${meals.toLocaleString()} Meals</strong></td>
                <td><strong>${group.totalKg} kg</strong></td>
                <td>${donorCount} Active Donors</td>
                <td style="color: #64748B; font-size: 12px;">${genDate}</td>
                <td>
                    <button class="btn-save-settings" style="padding: 6px 14px; font-size: 12px; background:#15803D; color:#fff;" onclick="downloadImpactReportPdf('${group.period}', ${meals}, ${group.totalKg}, ${donorCount})">
                        <i class="fa-solid fa-file-pdf"></i> Download PDF
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

// PDF Download Helper for Impact Reports
function downloadImpactReportPdf(period, meals, weight, donors) {
    const ngoName = currentNgoUser?.name || 'NGO Partner';
    const regNo = currentNgoUser?.reg_number || 'N/A';
    const co2 = (weight * 2.5).toFixed(1);

    const reportWindow = window.open('', '_blank', 'width=800,height=900');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${ngoName} - ${period} Impact Report</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #1e293b; background: #fff; }
                .header { border-bottom: 3px solid #15803d; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
                .title { font-size: 24px; font-weight: 800; color: #15803d; }
                .sub { font-size: 13px; color: #64748b; }
                .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
                .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 10px; }
                .card-title { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
                .card-val { font-size: 26px; font-weight: 800; color: #0f172a; }
                .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #94a3b8; display: flex; justify-content: space-between; }
                @media print { button { display: none; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div>
                    <div class="title">🌿 JIVAHAR VERIFIED IMPACT REPORT</div>
                    <div class="sub">Official Audit Summary for ${ngoName} (Reg: ${regNo})</div>
                </div>
                <div>
                    <button onclick="window.print()" style="background:#15803d; color:#fff; border:none; padding:10px 18px; font-weight:700; border-radius:6px; cursor:pointer;">🖨️ Print / Save PDF</button>
                </div>
            </div>

            <h2 style="font-size: 18px; color: #0f172a;">Audit Summary - ${period}</h2>
            <p style="color: #475569; font-size: 14px; margin-bottom: 25px;">This document certifies the total food rescued and community meals distributed through the Jivahar Zero Food Waste platform.</p>

            <div class="grid">
                <div class="card">
                    <div class="card-title">Total Community Meals Served</div>
                    <div class="card-val" style="color: #15803d;">${meals.toLocaleString()} Meals</div>
                </div>
                <div class="card">
                    <div class="card-title">Total Food Rescued</div>
                    <div class="card-val" style="color: #2563eb;">${weight} kg</div>
                </div>
                <div class="card">
                    <div class="card-title">Estimated CO₂ Landfill Offset</div>
                    <div class="card-val" style="color: #d97706;">${co2} kg</div>
                </div>
                <div class="card">
                    <div class="card-title">Active Partner Donors</div>
                    <div class="card-val" style="color: #7c3aed;">${donors} Donors</div>
                </div>
            </div>

            <div style="background:#f1f5f9; padding:20px; border-radius:10px; margin-top:20px;">
                <h4 style="margin:0 0 10px 0; color:#0f172a;">Platform Verification</h4>
                <p style="margin:0; font-size:13px; color:#475569;">All recorded donations are cryptographically logged and verified via the Jivahar Geo-Dispatch Engine. Standard conversion rate applied: 1 kg rescued food = 4 meals & 2.5 kg CO₂ offset.</p>
            </div>

            <div class="footer">
                <span>Generated on ${new Date().toLocaleDateString('en-GB')} | Jivahar Environmental Platform</span>
                <span>Authorized Signatory: ${currentNgoUser?.contact || 'Director'}</span>
            </div>
        </body>
        </html>
    `);
    reportWindow.document.close();
}

// Render Requests & Active Accepted Items Table
function renderNgoRequestsTable(donations) {
    const activeBody = document.getElementById('activeRequestsBody');
    const fullBody = document.getElementById('fullRequestsBody');

    const acceptedOrMine = donations.filter(d => d.status === 'Accepted' || d.status === 'Picked Up' || d.status === 'Delivered');

    const renderRow = (d) => {
        const firstItem = (d.items && d.items.length > 0) ? d.items[0] : { name: "Food Package" };
        let totalQty = 0;
        if (d.items) d.items.forEach(i => totalQty += Number(i.quantity || 0));

        let badgeClass = 'badge-pending';
        if (d.status === 'Accepted') badgeClass = 'badge-approved';
        if (d.status === 'Picked Up') badgeClass = 'badge-scheduled';
        if (d.status === 'Delivered') badgeClass = 'badge-completed';

        const shortId = d._id ? d._id.substring(0, 8).toUpperCase() : 'REQ-1001';

        return `
            <tr data-status="${d.status.toLowerCase()}">
                <td style="font-weight: 800; color: #15803D;">#${shortId}</td>
                <td style="font-weight: 700; color: #0F172A;">${firstItem.name}</td>
                <td style="color: #475569;">${d.pickup_details?.contact_name || 'Donor'}</td>
                <td style="font-weight: 600;">${totalQty} kg</td>
                <td style="color: #64748B; font-size: 12px;">${d.pickup_details?.address || 'Ballari'}</td>
                <td style="color: #64748B; font-size: 12px;">${d.pickup_details?.time || 'Today, Immediate'}</td>
                <td><span class="badge ${badgeClass}">${d.status}</span></td>
                <td>
                    ${d.pickup_details?.contact_phone ? `<button class="btn-help" style="padding: 4px 10px; font-size: 11px;" onclick="alert('Calling Donor (${d.pickup_details.contact_phone})')"><i class="fa-solid fa-phone"></i> Call Donor</button>` : `<span style="font-size:11px; color:#94A3B8;">Verified</span>`}
                </td>
            </tr>
        `;
    };

    if (activeBody && acceptedOrMine.length > 0) {
        activeBody.innerHTML = acceptedOrMine.slice(0, 3).map(renderRow).join('');
    }

    if (fullBody && acceptedOrMine.length > 0) {
        fullBody.innerHTML = acceptedOrMine.map(renderRow).join('');
    }
}

// ============================================
// NGO ACTIONS: ACCEPT / REJECT / REQUEST
// ============================================

// Accept Donation Action
window.handleAcceptDonation = function(donationId) {
    if (!confirm("Confirm accepting this donation for pickup?")) return;

    const payload = {
        ngo_id: currentNgoUser?._id || "",
        ngo_name: currentNgoUser?.name || "NGO Partner",
        ngo_phone: currentNgoUser?.phone || ""
    };

    fetch(`${API_BASE}/donations/accept/${donationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast(data.message || "Donation accepted! Assigned to your NGO.");
            loadNgoDashboardData();
            closeDecisionModal();
        } else {
            alert("Error: " + data.message);
        }
    })
    .catch(err => {
        console.error("Error accepting donation:", err);
        alert("Error connecting to server to accept donation.");
    });
};

let currentRejectingDonationId = null;

window.openDecisionRejectModal = function(donationId, title, qty, location) {
    currentRejectingDonationId = donationId;
    const modal = document.getElementById('ngoDecisionModal');
    if (!modal) return;

    document.getElementById('decisionItemTitle').textContent = title || 'Food Items';
    document.getElementById('decisionItemQty').textContent = qty || '50 kg';
    document.getElementById('decisionItemLocation').textContent = location || 'Local Address';
    
    document.getElementById('rejectionReasonBox').style.display = 'block';
    document.getElementById('btnConfirmModalAccept').onclick = function() { handleAcceptDonation(donationId); };
    document.getElementById('btnConfirmModalReject').onclick = function() { confirmModalReject(); };

    modal.style.display = 'flex';
};

window.closeDecisionModal = function() {
    const modal = document.getElementById('ngoDecisionModal');
    if (modal) modal.style.display = 'none';
};

window.confirmModalReject = function() {
    if (!currentRejectingDonationId) return;

    const donationId = String(currentRejectingDonationId);
    const reasonSelect = document.getElementById('decisionRejectionReasonSelect');
    const reason = reasonSelect ? reasonSelect.value : 'Out of capacity';

    // 1. Immediately cache rejection locally
    if (window.localNgoRejectedDonations) {
        window.localNgoRejectedDonations.add(donationId);
        try {
            localStorage.setItem('jivahar_ngo_rejected_donations', JSON.stringify([...window.localNgoRejectedDonations]));
        } catch(e) {}
    }

    // 2. Immediately remove from current in-memory lists for zero-latency UI update
    if (Array.isArray(allAvailableDonations)) {
        allAvailableDonations = allAvailableDonations.filter(d => String(d._id) !== donationId);
        renderIncomingNotifications(allAvailableDonations);
        renderAvailableDonationsList(allAvailableDonations);
        updateNgoMapMarkers(allAvailableDonations);
        updateNgoMetrics(allAvailableDonations);
    }

    closeDecisionModal();
    showToast("Donation passed / removed from your dashboard.");

    // 3. Send API request to persist rejection in database
    fetch(`${API_BASE}/donations/reject/${donationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ngo_id: currentNgoUser?._id, reason: reason })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            loadNgoDashboardData();
        } else {
            console.warn("Backend rejection notice:", data.message);
        }
    })
    .catch(err => console.error("Error rejecting donation:", err));
};

// Pickup Request Dialog Modal
window.handleRequestPickup = function(title, qty, location) {
    const modal = document.getElementById('requestModal');
    if (!modal) return;

    document.getElementById('modalItemTitle').textContent = title;
    document.getElementById('modalItemQuantity').textContent = qty;
    document.getElementById('modalItemLocation').textContent = location;

    modal.style.display = 'flex';
};

window.closeRequestModal = function() {
    const modal = document.getElementById('requestModal');
    if (modal) modal.style.display = 'none';
};

window.confirmPickupRequest = function() {
    showToast("Pickup request sent to donor! They will be notified immediately.");
    closeRequestModal();
};

// ============================================
// NGO SETTINGS SAVING
// ============================================
window.saveNgoSettings = function() {
    const name = document.getElementById('settingNgoName')?.value;
    const contact = document.getElementById('settingNgoContact')?.value;
    const email = document.getElementById('settingNgoEmail')?.value;
    const phone = document.getElementById('settingNgoPhone')?.value;
    const address = document.getElementById('settingNgoAddress')?.value;
    const radius = document.getElementById('settingNgoRadius')?.value;

    if (!name || !email || !phone) {
        alert("Please fill in required profile fields.");
        return;
    }

    currentNgoUser = {
        ...currentNgoUser,
        name: name,
        contact_person: contact,
        email: email,
        phone: phone,
        address: address,
        radius: radius
    };

    localStorage.setItem('jivahar_user', JSON.stringify(currentNgoUser));
    updateNgoProfileHeader();
    showToast("NGO profile settings saved successfully!");
};

// Category Filtering
window.filterDonationCategory = function(cat, chipEl) {
    if (chipEl) {
        document.querySelectorAll('.filter-chips-group .filter-chip').forEach(c => c.classList.remove('active'));
        chipEl.classList.add('active');
    }

    const cards = document.querySelectorAll('#fullDonationsList .donation-item-card');
    cards.forEach(card => {
        const itemCat = card.getAttribute('data-category') || '';
        if (cat === 'all' || itemCat.includes(cat)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

// Search Donations List
window.searchDonationsList = function() {
    const input = document.getElementById('donationSearchBox');
    const filter = input ? input.value.toLowerCase() : '';
    const cards = document.querySelectorAll('#fullDonationsList .donation-item-card');

    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        if (text.includes(filter)) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });
};

// Search Requests Table
window.searchRequestsTable = function() {
    const input = document.getElementById('requestSearchInput');
    const filter = input ? input.value.toLowerCase() : '';
    const rows = document.querySelectorAll('#allRequestsTable tbody tr');

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        if (text.includes(filter)) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
};

// Filter Requests Status Chips
window.filterRequestsStatus = function(status, chipEl) {
    if (chipEl) {
        document.querySelectorAll('.filter-chips-group .filter-chip').forEach(c => c.classList.remove('active'));
        chipEl.classList.add('active');
    }

    const rows = document.querySelectorAll('#allRequestsTable tbody tr');
    rows.forEach(row => {
        const rowStatus = row.getAttribute('data-status') || '';
        if (status === 'all' || rowStatus.includes(status)) {
            row.style.display = 'table-row';
        } else {
            row.style.display = 'none';
        }
    });
};

// Toast Notification Helper
window.showToast = function(message) {
    let toast = document.getElementById('ngoGlobalToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'ngoGlobalToast';
        toast.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#0F172A; color:#FFFFFF; padding:12px 20px; border-radius:10px; font-size:13px; font-weight:600; box-shadow:0 10px 25px rgba(0,0,0,0.2); z-index:10000; transition:all 0.3s; opacity:0; transform:translateY(10px); display:flex; align-items:center; gap:8px;';
        document.body.appendChild(toast);
    }

    toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color:#10B981;"></i> ${message}`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 3500);
};
