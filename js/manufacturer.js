// Jivahar Fertilizer Manufacturer Command Center Logic (Real-Time Live Data)
const API_BASE = 'http://localhost:5000/api';

let currentUser = null;
let currentWasteStreams = [];
let currentBatches = [];
let currentInventory = [];
let currentOrders = [];
let currentNotifications = [];

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initUserSession();
    initDateTimeDisplay();
    loadDashboardStats();
    loadWasteInflow();
    loadBatches();
    loadInventory();
    loadOrders();
    loadManufacturerNotifications();
    setupEventListeners();

    // Real-time polling for incoming non-edible waste streams & notifications (every 10s)
    setInterval(() => {
        loadManufacturerNotifications();
        loadWasteInflow(document.querySelector('#waste-filter-select')?.value || 'All', true);
        loadDashboardStats(true);
    }, 10000);
});

// User Session Management
function initUserSession() {
    try {
        const stored = localStorage.getItem('jivahar_user');
        if (stored) {
            currentUser = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Error reading jivahar_user from localStorage', e);
    }

    const nameEl = document.getElementById('user-company-name');
    const emailEl = document.getElementById('user-email-display');
    const avatarLetter = document.getElementById('user-avatar-letter');

    if (currentUser && currentUser.name) {
        if (nameEl) nameEl.textContent = currentUser.name;
        if (emailEl) emailEl.textContent = currentUser.email || 'Manufacturer Facility';
        if (avatarLetter) avatarLetter.textContent = currentUser.name.charAt(0).toUpperCase();
    } else {
        if (nameEl) nameEl.textContent = "GreenHarvester Bio-Tech";
        if (emailEl) emailEl.textContent = "mfg@jivahar.com";
        if (avatarLetter) avatarLetter.textContent = "G";
    }
}

// Live Time Display
function initDateTimeDisplay() {
    const timeEl = document.getElementById('current-live-time');
    if (!timeEl) return;
    const updateTime = () => {
        const now = new Date();
        timeEl.textContent = now.toLocaleDateString('en-IN', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };
    updateTime();
    setInterval(updateTime, 30000);
}

// Tab Switching
window.switchMfgTab = function(tabName, el) {
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    if (el) el.classList.add('active');

    document.querySelectorAll('.view-section').forEach(view => {
        view.style.display = 'none';
    });

    const target = document.getElementById(`view-${tabName}`);
    if (target) {
        target.style.display = 'flex';
    }

    if (tabName === 'dashboard') loadDashboardStats();
    else if (tabName === 'waste-inflow') loadWasteInflow();
    else if (tabName === 'batches') loadBatches();
    else if (tabName === 'inventory') loadInventory();
    else if (tabName === 'orders') loadOrders();
};

// 1. DASHBOARD STATS
async function loadDashboardStats(isSilent = false) {
    try {
        const res = await fetch(`${API_BASE}/manufacturer/stats`);
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                const wasteProcured = Number(data.total_waste_kg || 0);
                const activeBatches = Number(data.active_batches || 0);
                const readyFertilizer = Number(data.ready_fertilizer_kg || 0);
                const carbonOffset = Number(data.carbon_offset_kg || 0);

                updateStatCounter('stat-waste-procured', `${wasteProcured.toLocaleString()} kg`);
                updateStatCounter('stat-active-batches', `${activeBatches} Batches`);
                updateStatCounter('stat-ready-fertilizer', `${readyFertilizer.toLocaleString()} kg`);
                updateStatCounter('stat-carbon-offset', `${carbonOffset.toLocaleString()} kg CO₂e`);

                // Update Sustainability Report Cards
                updateStatCounter('report-carbon-offset', `${carbonOffset.toLocaleString()} kg CO₂e`);
                updateStatCounter('report-land-enriched', `${(wasteProcured * 0.012).toFixed(1)} Acres`);
                return;
            }
        }
    } catch (e) {
        if (!isSilent) console.warn('Stats fetch error:', e);
    }

    if (!isSilent) {
        updateStatCounter('stat-waste-procured', '0 kg');
        updateStatCounter('stat-active-batches', '0 Batches');
        updateStatCounter('stat-ready-fertilizer', '0 kg');
        updateStatCounter('stat-carbon-offset', '0 kg CO₂e');
    }
}

function updateStatCounter(elementId, text) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = text;
}

// 2. REAL-TIME NOTIFICATIONS
async function loadManufacturerNotifications() {
    try {
        const res = await fetch(`${API_BASE}/manufacturer/notifications`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.notifications)) {
                currentNotifications = data.notifications;
                renderNotificationsDropdown(data.unread_count || 0);
            }
        }
    } catch (e) {
        console.warn('Error loading notifications:', e);
    }
}

function renderNotificationsDropdown(unreadCount) {
    const badge = document.querySelector('.notification-badge');
    const list = document.getElementById('mfg-notifications-list');

    if (badge) {
        if (unreadCount > 0) {
            badge.style.display = 'flex';
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        } else {
            badge.style.display = 'none';
        }
    }

    if (!list) return;

    if (currentNotifications.length === 0) {
        list.innerHTML = `<p style="color:#94a3b8; font-size:12px; margin:0; padding:12px 0; text-align:center;">No new notifications</p>`;
        return;
    }

    list.innerHTML = currentNotifications.map(n => {
        let timeStr = 'Just now';
        if (n.created_at) {
            try {
                timeStr = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            } catch (e) {}
        }
        return `
            <div style="padding:10px 12px; background:${n.read ? '#f8fafc' : '#f0fdf4'}; border:1px solid ${n.read ? '#e2e8f0' : '#bbf7d0'}; border-radius:10px; margin-bottom:8px; font-size:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <strong style="color:${n.read ? '#334155' : '#15803d'}; font-size:12.5px;">${n.title}</strong>
                    <span style="font-size:10px; color:#94a3b8;">${timeStr}</span>
                </div>
                <p style="margin:0; color:#475569; line-height:1.4;">${n.message}</p>
                ${n.location ? `<div style="font-size:10.5px; color:#64748b; margin-top:4px;"><i class="fa-solid fa-location-dot" style="color:#ef4444; margin-right:4px;"></i>${n.location}</div>` : ''}
            </div>
        `;
    }).join('');
}

window.markNotificationsRead = async function() {
    try {
        await fetch(`${API_BASE}/manufacturer/notifications/mark-read`, { method: 'POST' });
        const badge = document.querySelector('.notification-badge');
        if (badge) badge.style.display = 'none';
        currentNotifications.forEach(n => n.read = true);
        renderNotificationsDropdown(0);
    } catch (e) {}
};

// 3. WASTE INFLOW STREAM (DIRECTED NON-EDIBLE DONATIONS & LOGGED INTAKES)
async function loadWasteInflow(filter = 'All', isSilent = false) {
    try {
        const res = await fetch(`${API_BASE}/manufacturer/waste-inflow`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.waste_streams)) {
                currentWasteStreams = data.waste_streams;
            }
        }
    } catch (e) {
        if (!isSilent) console.warn('Error loading waste inflow:', e);
    }

    renderWasteInflowTable(filter);
    renderRecentInflowPreview();
}

function renderWasteInflowTable(filter) {
    const tbody = document.getElementById('waste-inflow-tbody');
    if (!tbody) return;

    let items = currentWasteStreams || [];
    if (filter && filter !== 'All') {
        items = items.filter(i => (i.status || '').toLowerCase().includes(filter.toLowerCase()));
    }

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding:36px; color:#94a3b8; font-size:13px;">
                    <i class="fa-solid fa-inbox" style="font-size:24px; margin-bottom:8px; display:block; color:#cbd5e1;"></i>
                    No organic waste consignments available yet.<br>
                    <span style="font-size:12px;">Non-edible food donations from donors will automatically be routed here in real-time.</span>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map(item => {
        const isAvail = item.status === 'Available';
        const badgeColor = isAvail 
            ? 'background:#dcfce7; color:#15803d; border:1px solid #bbf7d0;'
            : 'background:#f1f5f9; color:#475569; border:1px solid #e2e8f0;';

        return `
            <tr>
                <td style="padding:14px 18px;">
                    <div style="font-weight:700; color:#0f172a; font-size:13.5px;">${item.source}</div>
                    <div style="font-size:11.5px; color:#64748b;"><i class="fa-solid fa-location-dot" style="color:#ef4444; margin-right:4px;"></i>${item.location || 'Local Region'}</div>
                </td>
                <td style="padding:14px 18px;">
                    <div style="font-weight:600; color:#1e293b; font-size:13px;">${item.waste_type}</div>
                    <div style="font-size:11px; color:#b91c1c; font-weight:600;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:4px;"></i>${item.shelf_life_note || 'Organic Food Waste'}</div>
                </td>
                <td style="padding:14px 18px; font-weight:700; color:#0f172a; font-size:13.5px;">
                    ${item.quantity_kg} ${item.unit || 'kg'}
                </td>
                <td style="padding:14px 18px;">
                    <span style="font-size:11.5px; font-weight:600; color:#475569; background:#f8fafc; padding:3px 8px; border-radius:6px; border:1px solid #e2e8f0;">
                        ${item.moisture_level || 'Medium (55%)'}
                    </span>
                </td>
                <td style="padding:14px 18px;">
                    <span style="font-size:11px; font-weight:700; padding:4px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:4px; ${badgeColor}">
                        <i class="fa-solid ${isAvail ? 'fa-circle-check' : 'fa-clock'}"></i>
                        ${item.status}
                    </span>
                </td>
                <td style="padding:14px 18px; text-align:right;">
                    ${isAvail ? `
                        <button class="btn btn-sm" onclick="claimConsignment('${item._id}')" style="background:#15803d; color:white; border:none; padding:7px 14px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-hand-holding-hand"></i> Claim Intake
                        </button>
                    ` : `
                        <span style="font-size:12px; font-weight:600; color:#94a3b8;"><i class="fa-solid fa-check"></i> In Composting</span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

function renderRecentInflowPreview() {
    const list = document.getElementById('recent-inflow-preview-list');
    if (!list) return;

    const previewItems = (currentWasteStreams || []).slice(0, 3);
    if (previewItems.length === 0) {
        list.innerHTML = `<p style="color:#94a3b8; font-size:12px; text-align:center; padding:16px;">No organic waste intakes yet.</p>`;
        return;
    }

    list.innerHTML = previewItems.map(item => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:#f8fafc; border-radius:10px; border:1px solid #e2e8f0; margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:34px; height:34px; border-radius:8px; background:#e0f2fe; color:#0284c7; display:flex; align-items:center; justify-content:center; font-size:14px;">
                    <i class="fa-solid fa-recycle"></i>
                </div>
                <div>
                    <div style="font-size:12.5px; font-weight:700; color:#0f172a;">${item.waste_type}</div>
                    <div style="font-size:11px; color:#64748b;">${item.source} • <strong>${item.quantity_kg} ${item.unit || 'kg'}</strong></div>
                </div>
            </div>
            <span style="font-size:10.5px; font-weight:700; padding:2px 8px; border-radius:8px; ${item.status === 'Available' ? 'background:#dcfce7; color:#15803d;' : 'background:#f1f5f9; color:#64748b;'}">
                ${item.status}
            </span>
        </div>
    `).join('');
}

window.claimConsignment = async function(streamId) {
    if (!confirm('Claim this organic waste consignment for your bio-fertilizer production facility?')) return;

    try {
        const res = await fetch(`${API_BASE}/manufacturer/waste-inflow/claim`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stream_id: streamId })
        });
        if (res.ok) {
            showToast('Consignment claimed successfully! Scheduled for shredding intake.', 'success');
        }
    } catch (e) {
        console.warn('Error claiming stream:', e);
    }

    loadWasteInflow();
    loadDashboardStats();
};

window.submitWasteLogForm = async function(e) {
    if (e) e.preventDefault();

    const source = document.getElementById('log-waste-source')?.value.trim();
    const wasteType = document.getElementById('log-waste-type')?.value.trim();
    const qty = parseFloat(document.getElementById('log-waste-qty')?.value);
    const moisture = document.getElementById('log-waste-moisture')?.value;
    const location = document.getElementById('log-waste-location')?.value.trim();
    const note = document.getElementById('log-waste-note')?.value.trim();

    if (!source || !wasteType || !qty || isNaN(qty) || qty <= 0) {
        alert('Please fill in Source, Waste Type, and a valid Weight (kg).');
        return;
    }

    const payload = {
        source: source,
        waste_type: wasteType,
        quantity_kg: qty,
        moisture_level: moisture || 'Medium (55%)',
        location: location || 'Bengaluru Local Region',
        shelf_life_note: note || 'Organic leftovers for composting'
    };

    try {
        const res = await fetch(`${API_BASE}/manufacturer/waste-inflow/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showToast(`Logged ${qty} kg of ${wasteType} successfully!`, 'success');
            closeModal('modal-log-waste');
            document.getElementById('form-log-waste')?.reset();
            loadWasteInflow();
            loadDashboardStats();
        }
    } catch (err) {
        alert('Failed to log consignment: ' + err);
    }
};

// 4. COMPOSTING BATCHES
async function loadBatches() {
    try {
        const res = await fetch(`${API_BASE}/manufacturer/batches`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.batches)) {
                currentBatches = data.batches;
            }
        }
    } catch (e) {
        console.warn('Error loading batches:', e);
    }

    renderBatchesGrid();
    renderDashboardActiveBatches();
}

function renderBatchesGrid() {
    const grid = document.getElementById('batches-cards-grid');
    if (!grid) return;

    if (!currentBatches || currentBatches.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:48px 20px; background:#fff; border:1px dashed #cbd5e1; border-radius:16px; color:#64748b;">
                <i class="fa-solid fa-flask-vial" style="font-size:32px; color:#94a3b8; margin-bottom:10px; display:block;"></i>
                <strong style="font-size:15px; color:#0f172a; display:block; margin-bottom:4px;">No Active Composting Batches</strong>
                <p style="font-size:12.5px; margin:0 0 16px;">Initiate a new batch with input feedstock and Ollama AI recipes.</p>
                <button onclick="openModal('modal-new-batch')" class="btn" style="background:#15803d; color:white; border:none; padding:8px 18px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;">
                    <i class="fa-solid fa-plus"></i> Start New Batch
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = currentBatches.map(b => {
        const progressPct = Math.min(100, Math.round((b.day_current / b.day_total) * 100));
        let stageColor = '#0284c7';
        let stageBg = '#e0f2fe';

        if (b.stage === 'Shredding') { stageColor = '#d97706'; stageBg = '#fef3c7'; }
        else if (b.stage === 'Active Composting') { stageColor = '#15803d'; stageBg = '#dcfce7'; }
        else if (b.stage === 'Curing') { stageColor = '#7c3aed'; stageBg = '#f3e8ff'; }
        else if (b.stage === 'Completed') { stageColor = '#166534'; stageBg = '#bbf7d0'; }

        return `
            <div class="card-container" style="display:flex; flex-direction:column; justify-content:space-between; position:relative; overflow:hidden;">
                <div style="position:absolute; top:0; left:0; right:0; height:4px; background:${stageColor};"></div>
                
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                        <div>
                            <span style="font-size:11px; font-weight:800; color:#64748b; letter-spacing:0.5px;">${b.batch_code}</span>
                            <h3 style="margin:2px 0 0; font-size:16px; font-weight:800; color:#0f172a;">${b.product_name}</h3>
                        </div>
                        <span style="background:${stageBg}; color:${stageColor}; font-size:11px; font-weight:800; padding:4px 10px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
                            <i class="fa-solid fa-arrows-spin"></i> ${b.stage}
                        </span>
                    </div>

                    <p style="font-size:12px; color:#475569; margin:0 0 14px; line-height:1.4;">
                        <strong>Input Feedstock:</strong> ${b.input_waste}
                    </p>

                    <!-- Progress Bar -->
                    <div style="margin-bottom:16px;">
                        <div style="display:flex; justify-content:space-between; font-size:11.5px; font-weight:700; color:#475569; margin-bottom:6px;">
                            <span>Day ${b.day_current} of ${b.day_total} (${progressPct}%)</span>
                            <span>${b.weight_kg} kg Feedstock</span>
                        </div>
                        <div style="height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                            <div style="width:${progressPct}%; height:100%; background:linear-gradient(90deg, #15803d, #22c55e); border-radius:4px; transition:width 0.4s ease;"></div>
                        </div>
                    </div>

                    <!-- Metrics Indicators -->
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; display:flex; align-items:center; gap:10px;">
                            <div style="width:30px; height:30px; border-radius:8px; background:#fee2e2; color:#ef4444; display:flex; align-items:center; justify-content:center; font-size:14px;">
                                <i class="fa-solid fa-temperature-high"></i>
                            </div>
                            <div>
                                <span style="font-size:10px; font-weight:700; color:#64748b; display:block;">CORE TEMP</span>
                                <strong style="font-size:13px; color:#0f172a;">${b.temperature_c}°C</strong>
                            </div>
                        </div>

                        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:10px 12px; display:flex; align-items:center; gap:10px;">
                            <div style="width:30px; height:30px; border-radius:8px; background:#e0f2fe; color:#0284c7; display:flex; align-items:center; justify-content:center; font-size:14px;">
                                <i class="fa-solid fa-droplet"></i>
                            </div>
                            <div>
                                <span style="font-size:10px; font-weight:700; color:#64748b; display:block;">MOISTURE</span>
                                <strong style="font-size:13px; color:#0f172a;">${b.moisture_pct}%</strong>
                            </div>
                        </div>
                    </div>

                    <div style="font-size:11.5px; color:#64748b; background:#f1f5f9; padding:8px 12px; border-radius:8px; margin-bottom:16px;">
                        <i class="fa-solid fa-flask" style="color:#15803d; margin-right:6px;"></i><strong>Inoculant:</strong> ${b.inoculant}
                        ${b.npk_ratio ? `<br><i class="fa-solid fa-certificate" style="color:#d97706; margin-right:6px;"></i><strong>NPK Grade:</strong> ${b.npk_ratio} • ${b.lab_cert}` : ''}
                    </div>
                </div>

                <!-- Action Footer -->
                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:12px;">
                    <span style="font-size:11px; font-weight:600; color:#94a3b8;">
                        <i class="fa-regular fa-calendar"></i> Turn every 4 days
                    </span>
                    ${b.stage !== 'Completed' ? `
                        <div style="display:flex; gap:6px;">
                            <button class="btn btn-sm" onclick="advanceBatchModal('${b._id}', '${b.stage}')" style="background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0; padding:6px 12px; border-radius:8px; font-weight:700; font-size:11.5px; cursor:pointer;">
                                <i class="fa-solid fa-forward-step"></i> Next Stage
                            </button>
                        </div>
                    ` : `
                        <span style="font-size:11.5px; font-weight:800; color:#15803d;"><i class="fa-solid fa-circle-check"></i> Quality Verified</span>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function renderDashboardActiveBatches() {
    const container = document.getElementById('dashboard-active-batches-list');
    if (!container) return;

    const activeList = (currentBatches || []).filter(b => b.stage !== 'Completed').slice(0, 3);
    if (activeList.length === 0) {
        container.innerHTML = `<p style="color:#94a3b8; font-size:13px; text-align:center; padding:24px;">No active batches in progress.</p>`;
        return;
    }

    container.innerHTML = activeList.map(b => {
        const progressPct = Math.min(100, Math.round((b.day_current / b.day_total) * 100));
        return `
            <div style="padding:14px 16px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; margin-bottom:12px; box-shadow:0 1px 3px rgba(0,0,0,0.02);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div>
                        <strong style="font-size:14px; color:#0f172a;">${b.product_name}</strong>
                        <span style="font-size:11px; color:#64748b; margin-left:8px;">${b.batch_code}</span>
                    </div>
                    <span style="font-size:11px; font-weight:700; color:#15803d; background:#dcfce7; padding:2px 8px; border-radius:10px;">
                        ${b.stage}
                    </span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b; margin-bottom:4px;">
                    <span>Day ${b.day_current}/${b.day_total} • Temp: ${b.temperature_c}°C</span>
                    <span>${b.weight_kg} kg</span>
                </div>
                <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                    <div style="width:${progressPct}%; height:100%; background:#15803d; border-radius:3px;"></div>
                </div>
            </div>
        `;
    }).join('');
}

window.advanceBatchModal = async function(batchId, currentStage) {
    let nextStage = 'Active Composting';
    if (currentStage === 'Shredding') nextStage = 'Active Composting';
    else if (currentStage === 'Active Composting') nextStage = 'Curing';
    else if (currentStage === 'Curing') nextStage = 'Completed';

    if (!confirm(`Advance this batch from "${currentStage}" to "${nextStage}"?`)) return;

    try {
        const res = await fetch(`${API_BASE}/manufacturer/batches/${batchId}/stage`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: nextStage })
        });
        if (res.ok) {
            showToast(`Batch moved to ${nextStage}!`, 'success');
        }
    } catch (e) {
        console.warn('Error advancing batch:', e);
    }

    loadBatches();
    loadDashboardStats();
};

window.submitNewBatchForm = async function(e) {
    if (e) e.preventDefault();

    const prodName = document.getElementById('new-batch-product')?.value.trim();
    const wasteMix = document.getElementById('new-batch-waste-type')?.value.trim();
    const weight = parseFloat(document.getElementById('new-batch-weight')?.value);
    const inoculant = document.getElementById('new-batch-inoculant')?.value.trim();
    const totalDays = parseInt(document.getElementById('new-batch-days')?.value) || 28;

    if (!prodName || !wasteMix || !weight || isNaN(weight) || weight <= 0) {
        alert('Please fill in Product Name, Waste Feedstock, and Weight.');
        return;
    }

    const payload = {
        product_name: prodName,
        input_waste: wasteMix,
        weight_kg: weight,
        inoculant: inoculant || 'Trichoderma & EM Consortium',
        day_total: totalDays
    };

    try {
        const res = await fetch(`${API_BASE}/manufacturer/batches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal('modal-new-batch');
            document.getElementById('form-new-batch')?.reset();
            showToast(`Composting batch for ${weight}kg initiated!`, 'success');
            loadBatches();
            loadDashboardStats();
        }
    } catch (err) {
        alert('Failed to initiate batch: ' + err);
    }
};

// OLLAMA AI COMPOST RECIPE ADVISOR
window.requestAiCompostRecommendation = async function() {
    const wasteType = document.getElementById('new-batch-waste-type')?.value.trim() || 'Cooked Food & Vegetable Scraps';
    const weight = parseFloat(document.getElementById('new-batch-weight')?.value) || 500;
    const moisture = document.getElementById('new-batch-moisture-est')?.value || 'Medium (55%)';

    const aiResultBox = document.getElementById('ai-compost-recipe-result');
    const aiBtn = document.getElementById('btn-get-ai-recipe');

    if (!aiResultBox) return;

    aiResultBox.style.display = 'block';
    aiResultBox.innerHTML = `
        <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:12px; padding:16px; color:#166534; font-size:12.5px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <i class="fa-solid fa-brain fa-spin" style="color:#15803d; font-size:16px;"></i>
                <strong>Consulting Ollama AI Compost Specialist...</strong>
            </div>
            <p style="margin:0; font-size:11.5px; color:#475569;">Formulating optimal C:N carbon bulking ratio, microbial inoculant, and thermophilic aeration schedule for ${weight}kg of ${wasteType}...</p>
        </div>
    `;

    if (aiBtn) {
        aiBtn.disabled = true;
        aiBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Formulating with Ollama...';
    }

    try {
        const res = await fetch(`${API_BASE}/ai/compost-recommendation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                waste_type: wasteType,
                weight_kg: weight,
                moisture_level: moisture
            })
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success && data.recommendation) {
                const rec = data.recommendation;
                
                const inoculantInput = document.getElementById('new-batch-inoculant');
                const daysInput = document.getElementById('new-batch-days');
                if (inoculantInput && rec.inoculant) inoculantInput.value = rec.inoculant;
                if (daysInput && rec.days_required) daysInput.value = rec.days_required;

                aiResultBox.innerHTML = `
                    <div style="background:#f0fdf4; border:1.5px solid #16a34a; border-radius:12px; padding:16px; font-size:12.5px; color:#0f172a;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <strong style="color:#15803d; font-size:13.5px;"><i class="fa-solid fa-robot"></i> Ollama AI Formulation Strategy</strong>
                            <span style="background:#dcfce7; color:#166534; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px;">
                                Target NPK: ${rec.expected_npk || '3.5 - 2.0 - 2.2'}
                            </span>
                        </div>
                        <div style="margin-bottom:8px;">
                            <strong style="color:#1e293b;"><i class="fa-solid fa-scale-balanced" style="color:#d97706; margin-right:4px;"></i> C:N Balance Recommendation:</strong>
                            <div style="color:#475569; margin-top:2px;">${rec.c_n_balance}</div>
                        </div>
                        <div style="margin-bottom:8px;">
                            <strong style="color:#1e293b;"><i class="fa-solid fa-flask" style="color:#2563eb; margin-right:4px;"></i> Inoculant & Activator:</strong>
                            <div style="color:#475569; margin-top:2px;">${rec.inoculant}</div>
                        </div>
                        <div style="background:#fff; border:1px solid #bbf7d0; border-radius:8px; padding:10px; color:#334155; font-size:12px; line-height:1.4;">
                            <i class="fa-solid fa-lightbulb" style="color:#15803d; margin-right:4px;"></i> ${rec.recipe_summary}
                        </div>
                    </div>
                `;
                return;
            }
        }
    } catch (e) {
        console.warn('AI recommendation error:', e);
    } finally {
        if (aiBtn) {
            aiBtn.disabled = false;
            aiBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI Recipe Advisor';
        }
    }
};

// 5. INVENTORY & QUALITY LAB
async function loadInventory() {
    try {
        const res = await fetch(`${API_BASE}/manufacturer/inventory`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.inventory)) {
                currentInventory = data.inventory;
            }
        }
    } catch (e) {
        console.warn('Error loading inventory:', e);
    }

    renderInventoryGrid();
}

function renderInventoryGrid() {
    const grid = document.getElementById('inventory-cards-grid');
    if (!grid) return;

    if (!currentInventory || currentInventory.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:48px 20px; background:#fff; border:1px dashed #cbd5e1; border-radius:16px; color:#64748b;">
                <i class="fa-solid fa-boxes-stacked" style="font-size:32px; color:#94a3b8; margin-bottom:10px; display:block;"></i>
                <strong style="font-size:15px; color:#0f172a; display:block; margin-bottom:4px;">No Fertilizer Inventory in Stock</strong>
                <p style="font-size:12.5px; margin:0 0 16px;">Log completed fertilizer bags or batches to make them available for farmer distribution.</p>
                <button onclick="openModal('modal-new-product')" class="btn" style="background:#15803d; color:white; border:none; padding:8px 18px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer;">
                    <i class="fa-solid fa-plus"></i> Add Finished Stock
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = currentInventory.map(item => `
        <div class="card-container" style="display:flex; flex-direction:column; justify-content:space-between;">
            <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <div>
                        <span style="font-size:11px; font-weight:700; color:#15803d; text-transform:uppercase; letter-spacing:0.4px;">${item.category}</span>
                        <h3 style="margin:2px 0 0; font-size:16.5px; font-weight:800; color:#0f172a;">${item.name}</h3>
                    </div>
                    <span style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:700; padding:4px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
                        <i class="fa-solid fa-shield-halved"></i> ${item.lab_status || 'FCO Verified'}
                    </span>
                </div>

                <!-- NPK Ratio Pill -->
                <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; font-size:11px; font-weight:700; color:#64748b; margin-bottom:4px;">
                        <span>N-P-K NUTRIENT RATIO</span>
                        <span style="color:#0f172a;">pH: ${item.ph_level || '7.0'} • Moist: ${item.moisture_pct}%</span>
                    </div>
                    <div style="font-size:16px; font-weight:800; color:#0f172a; letter-spacing:0.5px;">
                        ${item.npk_ratio || '3.0 - 2.0 - 2.0'}
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; font-size:13px; color:#475569;">
                    <div>
                        <span style="font-size:11px; color:#64748b; display:block;">AVAILABLE STOCK</span>
                        <strong style="font-size:18px; color:#0f172a; font-weight:800;">${Number(item.stock_kg).toLocaleString()} kg</strong>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:11px; color:#64748b; display:block;">PACKAGING</span>
                        <strong style="color:#0f172a; font-size:13px;">${item.packaging || 'Bags'}</strong>
                    </div>
                </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #f1f5f9; padding-top:12px;">
                <div>
                    <span style="font-size:11px; color:#64748b; display:block;">RATE</span>
                    <strong style="font-size:15px; color:#15803d; font-weight:800;">₹${item.price_inr} <span style="font-size:11px; font-weight:600; color:#64748b;">${item.unit || ''}</span></strong>
                </div>
                <button class="btn btn-sm" onclick="quickOrderProduct('${item.name}')" style="background:#15803d; color:white; border:none; padding:8px 14px; border-radius:8px; font-weight:700; font-size:12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
                    <i class="fa-solid fa-cart-plus"></i> Dispatch Order
                </button>
            </div>
        </div>
    `).join('');
}

window.quickOrderProduct = function(productName) {
    openModal('modal-new-order');
    const itemSelect = document.getElementById('order-item-name');
    if (itemSelect) itemSelect.value = productName;
};

window.submitNewProductForm = async function(e) {
    if (e) e.preventDefault();

    const name = document.getElementById('prod-name')?.value.trim();
    const category = document.getElementById('prod-category')?.value;
    const stock = parseFloat(document.getElementById('prod-stock')?.value);
    const packaging = document.getElementById('prod-packaging')?.value.trim();
    const price = parseFloat(document.getElementById('prod-price')?.value);
    const npk = document.getElementById('prod-npk')?.value.trim();

    if (!name || !stock || isNaN(stock) || stock <= 0) {
        alert('Please fill in Product Name and valid Stock (kg).');
        return;
    }

    const payload = {
        name: name,
        category: category || 'Solid Organic Fertilizer',
        stock_kg: stock,
        packaging: packaging || '50 kg Bags',
        price_inr: price || 400,
        npk_ratio: npk || '3.5 - 2.0 - 2.0'
    };

    try {
        const res = await fetch(`${API_BASE}/manufacturer/inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal('modal-new-product');
            document.getElementById('form-new-product')?.reset();
            showToast(`Added ${name} to inventory!`, 'success');
            loadInventory();
            loadDashboardStats();
        }
    } catch (err) {
        alert('Failed to add product: ' + err);
    }
};

// 6. FARMER ORDERS & DISTRIBUTION
async function loadOrders(filter = 'All') {
    try {
        const res = await fetch(`${API_BASE}/manufacturer/orders`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && Array.isArray(data.orders)) {
                currentOrders = data.orders;
            }
        }
    } catch (e) {
        console.warn('Error loading orders:', e);
    }

    renderOrdersTable(filter);
}

function renderOrdersTable(filter) {
    const tbody = document.getElementById('orders-table-tbody');
    if (!tbody) return;

    let items = currentOrders || [];
    if (filter && filter !== 'All') {
        items = items.filter(o => (o.status || '').toLowerCase() === filter.toLowerCase());
    }

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align:center; padding:36px; color:#94a3b8; font-size:13px;">
                    <i class="fa-solid fa-clipboard-list" style="font-size:24px; margin-bottom:8px; display:block; color:#cbd5e1;"></i>
                    No farmer orders placed yet.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = items.map(o => {
        let badgeColor = 'background:#f1f5f9; color:#475569;';
        if (o.status === 'Approved') badgeColor = 'background:#e0f2fe; color:#0284c7;';
        else if (o.status === 'Dispatched') badgeColor = 'background:#fef3c7; color:#d97706;';
        else if (o.status === 'Delivered') badgeColor = 'background:#dcfce7; color:#15803d;';

        return `
            <tr>
                <td style="padding:14px 18px; font-weight:800; color:#0f172a; font-size:12.5px;">${o.order_id}</td>
                <td style="padding:14px 18px;">
                    <div style="font-weight:700; color:#0f172a; font-size:13px;">${o.buyer_name}</div>
                    <div style="font-size:11px; color:#64748b;">${o.location} • ${o.contact_phone}</div>
                </td>
                <td style="padding:14px 18px; font-size:13px; color:#334155; font-weight:600;">${o.item_name}</td>
                <td style="padding:14px 18px; font-size:13px; font-weight:700; color:#0f172a;">${o.quantity}</td>
                <td style="padding:14px 18px; font-size:13.5px; font-weight:800; color:#15803d;">₹${Number(o.amount_inr).toLocaleString()}</td>
                <td style="padding:14px 18px;">
                    <span style="font-size:11px; font-weight:700; padding:4px 10px; border-radius:12px; ${badgeColor}">
                        ${o.status}
                    </span>
                </td>
                <td style="padding:14px 18px; text-align:right;">
                    ${o.status === 'Approved' ? `
                        <button class="btn btn-sm" onclick="updateOrderStatus('${o._id}', 'Dispatched')" style="background:#fef3c7; color:#d97706; border:1px solid #fde68a; padding:6px 12px; border-radius:8px; font-weight:700; font-size:11.5px; cursor:pointer;">
                            <i class="fa-solid fa-truck"></i> Dispatch
                        </button>
                    ` : o.status === 'Dispatched' ? `
                        <button class="btn btn-sm" onclick="updateOrderStatus('${o._id}', 'Delivered')" style="background:#dcfce7; color:#15803d; border:1px solid #bbf7d0; padding:6px 12px; border-radius:8px; font-weight:700; font-size:11.5px; cursor:pointer;">
                            <i class="fa-solid fa-check"></i> Mark Delivered
                        </button>
                    ` : `
                        <span style="color:#15803d; font-size:11.5px; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Fulfilled</span>
                    `}
                </td>
            </tr>
        `;
    }).join('');
}

window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const res = await fetch(`${API_BASE}/manufacturer/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            showToast(`Order status updated to ${newStatus}!`, 'success');
        }
    } catch (e) {
        console.warn('Update order error:', e);
    }

    loadOrders();
};

window.submitNewOrderForm = async function(e) {
    if (e) e.preventDefault();

    const buyer = document.getElementById('order-buyer-name')?.value.trim();
    const phone = document.getElementById('order-contact-phone')?.value.trim();
    const loc = document.getElementById('order-location')?.value.trim();
    const item = document.getElementById('order-item-name')?.value;
    const qty = document.getElementById('order-quantity')?.value.trim();
    const amt = parseFloat(document.getElementById('order-amount')?.value);

    if (!buyer || !item || !qty || !amt || isNaN(amt)) {
        alert('Please fill in Farmer Name, Product, Quantity, and Amount.');
        return;
    }

    const payload = {
        buyer_name: buyer,
        contact_phone: phone || '+91 98000 00000',
        location: loc || 'Karnataka Agricultural Cluster',
        item_name: item,
        quantity: qty,
        amount_inr: amt
    };

    try {
        const res = await fetch(`${API_BASE}/manufacturer/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            closeModal('modal-new-order');
            document.getElementById('form-new-order')?.reset();
            showToast(`Order for ${buyer} created successfully!`, 'success');
            loadOrders();
        }
    } catch (err) {
        alert('Failed to create order: ' + err);
    }
};

// UI Modal Utilities
window.openModal = function(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
};

window.closeModal = function(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
};

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast-alert';
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: #0f172a;
        color: #ffffff;
        padding: 12px 20px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 9999;
        display: flex;
        align-items: center;
        gap: 10px;
        border-left: 4px solid ${type === 'success' ? '#22c55e' : '#3b82f6'};
        animation: fadeIn 0.3s ease;
    `;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-circle-info'}" style="color:${type === 'success' ? '#22c55e' : '#3b82f6'}"></i> <span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function setupEventListeners() {
    const bellBtn = document.getElementById('notification-bell-btn');
    const dropdown = document.getElementById('mfg-notification-dropdown');
    if (bellBtn && dropdown) {
        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
            if (dropdown.classList.contains('active')) {
                markNotificationsRead();
            }
        });
        document.addEventListener('click', () => {
            dropdown.classList.remove('active');
        });
    }
}
