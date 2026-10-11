const API_BASE = 'http://127.0.0.1:5000/api';
let currentVolunteer = null;

document.addEventListener('DOMContentLoaded', () => {
    const userStr = localStorage.getItem('jivahar_user');
    if (userStr) {
        try {
            const parsed = JSON.parse(userStr);
            if (parsed && (parsed.role || '').toLowerCase() === 'volunteer') {
                currentVolunteer = parsed;
            }
        } catch(e) {}
    }

    if (!currentVolunteer) {
        window.location.href = 'login-volunteer.html';
        return;
    }

    const nameEl = document.getElementById('vol-name');
    const emailEl = document.getElementById('vol-email');
    const avatarEl = document.getElementById('vol-avatar');

    if (nameEl) nameEl.textContent = currentVolunteer.name || 'Volunteer Courier';
    if (emailEl) emailEl.textContent = currentVolunteer.email || 'volunteer@jivahar.org';
    if (avatarEl && currentVolunteer.name) avatarEl.textContent = currentVolunteer.name.charAt(0).toUpperCase();

    loadVolunteerTasks();
});

function loadVolunteerTasks() {
    const container = document.getElementById('volunteer-tasks-container');
    if (container) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;">Loading tasks...</div>';
    }

    fetch(`${API_BASE}/donations/all`)
        .then(res => res.json())
        .then(data => {
            if (data.success && data.donations) {
                renderVolunteerTasks(data.donations);
            } else {
                if (container) container.innerHTML = '<div style="text-align:center; padding:30px; color:red;">Failed to load tasks.</div>';
            }
        })
        .catch(err => {
            console.error('Error loading volunteer tasks:', err);
            if (container) container.innerHTML = '<div style="text-align:center; padding:30px; color:red;">Network error fetching tasks.</div>';
        });
}

function renderVolunteerTasks(donations) {
    const container = document.getElementById('volunteer-tasks-container');
    const activeStatEl = document.getElementById('stat-active-pickups');
    const completedStatEl = document.getElementById('stat-completed-deliveries');
    const kgStatEl = document.getElementById('stat-kg-rescued');

    if (!container) return;

    // Filter relevant donations: Accepted, Picked Up, Delivered, Pending
    const tasks = donations.filter(d => d.status === 'Accepted' || d.status === 'Picked Up' || d.status === 'Delivered' || d.status === 'Pending');

    let activeCount = 0;
    let completedCount = 0;
    let totalKg = 0;

    tasks.forEach(t => {
        if (t.status === 'Accepted' || t.status === 'Picked Up') activeCount++;
        if (t.status === 'Delivered') {
            completedCount++;
            if (t.items) {
                t.items.forEach(item => {
                    const qty = Number(item.quantity || 0);
                    if (item.unit === 'kg') totalKg += qty;
                    else totalKg += qty * 0.1;
                });
            }
        }
    });

    if (activeStatEl) activeStatEl.textContent = activeCount;
    if (completedStatEl) completedStatEl.textContent = completedCount;
    if (kgStatEl) kgStatEl.textContent = `${totalKg.toFixed(1)} kg`;

    if (tasks.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#64748b; background:#fff; border-radius:16px; border:1px solid #e2e8f0;">
                <i class="fa-solid fa-box-open" style="font-size:32px; color:#cbd5e1; margin-bottom:12px;"></i>
                <div style="font-weight:600;">No active food delivery tasks right now.</div>
                <div style="font-size:12px; margin-top:4px;">As soon as an NGO accepts a food donation, it will appear here for pickup.</div>
            </div>
        `;
        return;
    }

    container.innerHTML = tasks.map(don => {
        const item = (don.items && don.items.length > 0) ? don.items[0] : { name: "Food Items", quantity: 10, unit: "kg" };
        const pickupAddr = don.pickup_details?.address || don.pickup_location?.address || 'Bangalore pickup point';
        const ngoName = don.assigned_ngo?.name || 'Partner NGO Shelter';
        const status = don.status || 'Pending';

        let badgeStyle = 'background:#fef3c7; color:#b45309;';
        let actionBtnHtml = '';

        if (status === 'Pending') {
            badgeStyle = 'background:#fef3c7; color:#b45309;';
            actionBtnHtml = `<span style="font-size:12px; color:#64748b; font-weight:600;">Awaiting NGO Acceptance</span>`;
        } else if (status === 'Accepted') {
            badgeStyle = 'background:#dbeafe; color:#1e40af;';
            actionBtnHtml = `
                <button class="btn-action btn-pickup" onclick="updateTaskStatus('${don._id}', 'Picked Up')">
                    <i class="fa-solid fa-truck-fast"></i> Start Pickup
                </button>
            `;
        } else if (status === 'Picked Up') {
            badgeStyle = 'background:#e0e7ff; color:#3730a3;';
            actionBtnHtml = `
                <button class="btn-action btn-deliver" onclick="updateTaskStatus('${don._id}', 'Delivered')">
                    <i class="fa-solid fa-circle-check"></i> Complete Delivery
                </button>
            `;
        } else if (status === 'Delivered') {
            badgeStyle = 'background:#dcfce7; color:#166534;';
            actionBtnHtml = `<span style="font-size:12px; color:#166534; font-weight:700;">✓ Delivered Successfully</span>`;
        }

        return `
            <div class="task-card">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <div>
                        <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; letter-spacing:0.5px;">Donation #${don._id.substring(0,8)}</span>
                        <h3 style="margin:4px 0 0 0; font-size:16px; font-weight:700; color:#0f172a;">${item.name} (${item.quantity} ${item.unit || 'kg'})</h3>
                    </div>
                    <span style="padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; ${badgeStyle}">
                        ${status}
                    </span>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; font-size:13px; margin-bottom:16px; background:#f8fafc; padding:12px 16px; border-radius:12px;">
                    <div>
                        <strong style="color:#64748b; display:block; font-size:11px; text-transform:uppercase;">Pickup Point</strong>
                        <span style="color:#0f172a; font-weight:600;"><i class="fa-solid fa-location-dot" style="color:#ef4444; margin-right:4px;"></i> ${pickupAddr}</span>
                    </div>
                    <div>
                        <strong style="color:#64748b; display:block; font-size:11px; text-transform:uppercase;">Delivery Destination</strong>
                        <span style="color:#0f172a; font-weight:600;"><i class="fa-solid fa-building-ngo" style="color:#2563eb; margin-right:4px;"></i> ${ngoName}</span>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:12px; color:#64748b;"><i class="fa-regular fa-clock"></i> Posted: ${don.created_at ? new Date(don.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Today'}</span>
                    <div>
                        ${actionBtnHtml}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateTaskStatus(donationId, newStatus) {
    const volName = currentVolunteer ? currentVolunteer.name : 'Volunteer Courier';
    const volPhone = currentVolunteer?.phone || '';

    fetch(`${API_BASE}/donations/update-status/${donationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            status: newStatus,
            volunteer_name: volName,
            volunteer_phone: volPhone
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(`🎉 Task status updated to '${newStatus}'!`);
            loadVolunteerTasks();
        } else {
            alert(`❌ Error: ${data.message}`);
        }
    })
    .catch(err => {
        console.error('Error updating status:', err);
        alert('❌ Network error updating task status.');
    });
}
