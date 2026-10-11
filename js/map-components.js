/**
 * Jivahar Production Map System
 * Modular Reusable Map Components & Geo Engine for Donor & NGO Dashboards
 */

// 1. NGO & Donor Custom Map Markers Component
const MapIcons = {
    // 🏢 NGO Permanent Registered Location Marker Icon
    createNgoMarker: function(name = 'NGO Shelter') {
        return L.divIcon({
            html: `
                <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
                    <div style="position:absolute; width:48px; height:48px; background:rgba(37, 99, 235, 0.25); border-radius:50%; animation: pulse-ring 2s infinite;"></div>
                    <div style="width:40px; height:40px; background:linear-gradient(135deg, #1D4ED8 0%, #1E40AF 100%); border:3px solid #FFFFFF; border-radius:12px; display:flex; align-items:center; justify-content:center; box-shadow:0 8px 20px rgba(29,78,216,0.45); z-index:10;">
                        <i class="fa-solid fa-building-ngo" style="color:#FFFFFF; font-size:18px;"></i>
                    </div>
                </div>
            `,
            className: 'custom-ngo-building-marker',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
            popupAnchor: [0, -22]
        });
    },

    // 📦 Donor Specific Food Pickup Location Marker Icon
    createPickupMarker: function(category = 'Food Package') {
        let iconClass = 'fa-box-archive';
        const catLower = (category || '').toLowerCase();
        if (catLower.includes('rice') || catLower.includes('cooked') || catLower.includes('veg')) iconClass = 'fa-bowl-rice';
        else if (catLower.includes('fruit') || catLower.includes('fresh')) iconClass = 'fa-apple-whole';
        else if (catLower.includes('bakery') || catLower.includes('sweet')) iconClass = 'fa-cookie-bite';
        else if (catLower.includes('meal')) iconClass = 'fa-bell-concierge';

        return L.divIcon({
            html: `
                <div style="position:relative; width:42px; height:42px; display:flex; align-items:center; justify-content:center;">
                    <div style="position:absolute; width:44px; height:44px; background:rgba(22, 163, 74, 0.35); border-radius:50%; animation: pulse-ring 2s infinite;"></div>
                    <div style="width:40px; height:40px; background:linear-gradient(135deg, #16A34A 0%, #15803D 100%); border:3px solid #FFFFFF; border-radius:50% 50% 50% 0; transform:rotate(-45deg); display:flex; align-items:center; justify-content:center; box-shadow:0 8px 20px rgba(22,163,74,0.45); z-index:9;">
                        <i class="fa-solid ${iconClass}" style="color:#FFFFFF; font-size:17px; transform:rotate(45deg);"></i>
                    </div>
                </div>
            `,
            className: 'custom-donor-pickup-marker',
            iconSize: [42, 42],
            iconAnchor: [21, 42],
            popupAnchor: [0, -42]
        });
    }
};

// 2. LocationPicker Component (GPS locate, Nominatim Address Search, Map Click & Draggable Marker)
class LocationPicker {
    constructor(config) {
        this.containerId = config.containerId;
        this.searchInputId = config.searchInputId;
        this.resultsContainerId = config.resultsContainerId;
        this.addressInputId = config.addressInputId;
        this.latInputId = config.latInputId;
        this.lngInputId = config.lngInputId;
        this.initialLat = config.initialLat || 12.9784;
        this.initialLng = config.initialLng || 77.6408;
        this.markerType = config.markerType || 'pickup';
        this.onLocationSelected = config.onLocationSelected || null;

        this.map = null;
        this.marker = null;
        this.init();
    }

    init() {
        const mapEl = document.getElementById(this.containerId);
        if (!mapEl || typeof L === 'undefined') return;

        // Check if map already initialized on element
        if (mapEl._leaflet_id) return;

        this.map = L.map(this.containerId).setView([this.initialLat, this.initialLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);

        const icon = this.markerType === 'ngo' ? MapIcons.createNgoMarker() : MapIcons.createPickupMarker();
        this.marker = L.marker([this.initialLat, this.initialLng], { icon: icon, draggable: true }).addTo(this.map);

        // Update position on pin drag
        this.marker.on('dragend', (e) => {
            const pos = e.target.getLatLng();
            this.reverseGeocode(pos.lat, pos.lng);
        });

        // Update position on map click
        this.map.on('click', (e) => {
            this.marker.setLatLng(e.latlng);
            this.reverseGeocode(e.latlng.lat, e.latlng.lng);
        });
    }

    setLocation(lat, lng, address = '') {
        if (!this.map || !this.marker) return;
        this.map.setView([lat, lng], 15);
        this.marker.setLatLng([lat, lng]);

        if (address) {
            this.updateFormInputs(address, lat, lng);
        } else {
            this.reverseGeocode(lat, lng);
        }
    }

    useCurrentGpsLocation(callback) {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                this.setLocation(lat, lng);
                if (callback) callback(lat, lng);
            },
            (err) => {
                console.warn("Geolocation permission error:", err.message);
                alert("Location access denied or unavailable. Please search your address or click on the map to set your pin.");
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    }

    reverseGeocode(lat, lng) {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
        fetch(url)
            .then(res => res.json())
            .then(data => {
                const address = data.display_name || `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
                this.updateFormInputs(address, lat, lng);
            })
            .catch(() => {
                const fallbackAddr = `Selected Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
                this.updateFormInputs(fallbackAddr, lat, lng);
            });
    }

    searchAddress(query) {
        if (!query || query.length < 3) return;
        const resultsEl = document.getElementById(this.resultsContainerId);
        if (resultsEl) resultsEl.style.display = 'none';

        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;
        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (resultsEl && data && data.length > 0) {
                    resultsEl.innerHTML = data.map(item => `
                        <div style="padding:10px 14px; border-bottom:1px solid #f1f5f9; cursor:pointer; font-size:12px; color:#1e293b;"
                             onclick="window['${this.containerId}_picker'].selectSearchResult(${item.lat}, ${item.lon}, '${item.display_name.replace(/'/g, "\\'")}')"
                             onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='#fff'">
                            📍 <strong>${item.display_name.split(',')[0]}</strong><br>
                            <span style="font-size:11px; color:#64748b;">${item.display_name}</span>
                        </div>
                    `).join('');
                    resultsEl.style.display = 'block';
                }
            })
            .catch(() => {});
    }

    selectSearchResult(lat, lng, address) {
        const resultsEl = document.getElementById(this.resultsContainerId);
        if (resultsEl) resultsEl.style.display = 'none';
        const searchInput = document.getElementById(this.searchInputId);
        if (searchInput) searchInput.value = address;
        this.setLocation(Number(lat), Number(lng), address);
    }

    updateFormInputs(address, lat, lng) {
        if (this.addressInputId) {
            const el = document.getElementById(this.addressInputId);
            if (el) el.value = address;
        }
        if (this.latInputId) {
            const el = document.getElementById(this.latInputId);
            if (el) el.value = Number(lat).toFixed(6);
        }
        if (this.lngInputId) {
            const el = document.getElementById(this.lngInputId);
            if (el) el.value = Number(lng).toFixed(6);
        }

        if (this.onLocationSelected) {
            this.onLocationSelected({ address, latitude: Number(lat), longitude: Number(lng) });
        }
    }
}

// 3. RouteMap Component (OSRM Road Routing, Distance, Duration & External Navigation)
class RouteMap {
    static drawRoute(mapInstance, ngoLat, ngoLng, donorLat, donorLng, ngoName = 'NGO Center', pickupAddress = 'Donor Pickup Point', containerCardId = null) {
        if (!mapInstance || !ngoLat || !ngoLng || !donorLat || !donorLng) return;

        // Clear existing route polylines
        mapInstance.eachLayer(layer => {
            if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
                mapInstance.removeLayer(layer);
            }
        });

        const ngoMarker = L.marker([ngoLat, ngoLng], { icon: MapIcons.createNgoMarker(ngoName) })
            .addTo(mapInstance)
            .bindPopup(`
                <div style="padding:4px; font-family:'Plus Jakarta Sans', sans-serif;">
                    <strong style="color:#1d4ed8; font-size:13px;">🏢 ${ngoName}</strong>
                    <div style="font-size:11px; color:#16a34a; font-weight:600;">NGO Permanent Established Location</div>
                    <div style="font-size:11px; color:#64748b;">📍 ${ngoLat.toFixed(4)}, ${ngoLng.toFixed(4)}</div>
                </div>
            `);

        const pickupMarker = L.marker([donorLat, donorLng], { icon: MapIcons.createPickupMarker() })
            .addTo(mapInstance)
            .bindPopup(`
                <div style="padding:4px; font-family:'Plus Jakarta Sans', sans-serif;">
                    <strong style="color:#16a34a; font-size:13px;">📦 Donor Specific Pickup Location</strong>
                    <div style="font-size:11px; color:#475569;">${pickupAddress}</div>
                </div>
            `);

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${donorLng},${donorLat};${ngoLng},${ngoLat}?overview=full&geometries=geojson`;

        fetch(osrmUrl)
            .then(res => res.json())
            .then(data => {
                let distKm = '0.0';
                let durationMins = 0;

                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
                    distKm = (route.distance / 1000).toFixed(1);
                    durationMins = Math.round(route.duration / 60);

                    const polyline = L.polyline(coords, {
                        color: '#16a34a',
                        weight: 6,
                        opacity: 0.9,
                        dashArray: '8, 8'
                    }).addTo(mapInstance);

                    polyline.bindTooltip(`🛣️ Pickup Route: ${distKm} km (~${durationMins} mins)`, { permanent: true, sticky: true });
                    mapInstance.fitBounds(polyline.getBounds(), { padding: [40, 40] });
                } else {
                    const directCoords = [[donorLat, donorLng], [ngoLat, ngoLng]];
                    const polyline = L.polyline(directCoords, { color: '#16a34a', weight: 4, dashArray: '6, 6' }).addTo(mapInstance);
                    mapInstance.fitBounds(polyline.getBounds(), { padding: [40, 40] });
                }

                // Render Information Card Overlay matching Spec 3 & 5
                if (containerCardId) {
                    const cardEl = document.getElementById(containerCardId);
                    if (cardEl) {
                        cardEl.innerHTML = `
                            <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:14px; padding:18px; box-shadow:0 8px 24px rgba(0,0,0,0.08); font-family:'Plus Jakarta Sans', sans-serif;">
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #f1f5f9; padding-bottom:12px; margin-bottom:12px;">
                                    <div>
                                        <strong style="font-size:16px; color:#1e293b; display:block;">🏢 ${ngoName}</strong>
                                        <span style="font-size:12px; color:#64748b;">NGO Permanent Location</span>
                                    </div>
                                    <span style="font-size:11px; font-weight:700; background:#dbeafe; color:#1d4ed8; padding:4px 10px; border-radius:6px;">Verified NGO</span>
                                </div>
                                <div style="margin-bottom:14px;">
                                    <div style="font-size:11px; color:#64748b; font-weight:700; text-transform:uppercase;">📍 Specific Donation Pickup Location</div>
                                    <div style="font-size:14px; color:#0f172a; font-weight:600; margin-top:2px;">${pickupAddress}</div>
                                </div>
                                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; background:#f8fafc; padding:12px 14px; border-radius:10px; margin-bottom:14px;">
                                    <div>
                                        <span style="font-size:11px; color:#64748b; display:block;">Driving Distance</span>
                                        <strong style="font-size:15px; color:#15803d;">🛣️ ${distKm} km</strong>
                                    </div>
                                    <div>
                                        <span style="font-size:11px; color:#64748b; display:block;">Est. Travel Time</span>
                                        <strong style="font-size:15px; color:#2563eb;">⏱️ ${durationMins} min</strong>
                                    </div>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div style="display:flex; gap:14px; font-size:11px; color:#475569;">
                                        <span>🏢 <strong>NGO Location</strong></span>
                                        <span>📍 <strong>Pickup Location</strong></span>
                                    </div>
                                    <button class="btn btn-primary" onclick="RouteMap.openExternalNavigation(${ngoLat}, ${ngoLng}, ${donorLat}, ${donorLng})" style="padding:8px 16px; font-size:12px; background:#16a34a; color:#fff; border:none; border-radius:8px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                                        <i class="fa-solid fa-diamond-turn-right"></i> Start Navigation
                                    </button>
                                </div>
                            </div>
                        `;
                    }
                }
            })
            .catch(() => {});
    }

    static openExternalNavigation(ngoLat, ngoLng, donorLat, donorLng) {
        if (!donorLat || !donorLng) {
            alert("Pickup location coordinates not available.");
            return;
        }
        let navUrl = `https://www.google.com/maps/dir/?api=1&destination=${donorLat},${donorLng}&travelmode=driving`;
        if (ngoLat && ngoLng) {
            navUrl = `https://www.google.com/maps/dir/?api=1&origin=${ngoLat},${ngoLng}&destination=${donorLat},${donorLng}&travelmode=driving`;
        }
        window.open(navUrl, '_blank');
    }
}
