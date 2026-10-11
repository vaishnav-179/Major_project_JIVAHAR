const API_BASE = 'http://127.0.0.1:5000/api';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Get Logged In User
    let userStr = localStorage.getItem('jivahar_user');
    if (!userStr) {
        window.location.href = 'login-donor.html';
        return;
    }
    
    let user = null;
    try { user = JSON.parse(userStr); } catch(e){}
    if (user && (user.role || '').toLowerCase() !== 'donor') { user = null; }
    if (!user) {
        window.location.href = "login-donor.html";
        return;
    }
    const donorId = user._id;

    // Update Topbar Profile
    const profileNameEl = document.querySelector('.user-name');
    const profileRoleEl = document.querySelector('.user-role');
    if (profileRoleEl) profileRoleEl.textContent = 'DONOR';
    if (profileNameEl && user.name) {
        profileNameEl.textContent = user.name;
    }
    
    const userAvatarEl = document.querySelector('.user-avatar');
    if (userAvatarEl && user.name) {
        userAvatarEl.textContent = user.name.charAt(0).toUpperCase();
    }

    // 2. Fetch User Stats
    fetch(`${API_BASE}/donations/stats/${donorId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateDashboardStats(data.stats);
            }
        })
        .catch(err => console.error("Error fetching stats:", err));

    // 3. Fetch User Donations
    fetch(`${API_BASE}/donations/${donorId}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                window.userDonations = data.donations;
                renderDonationsTable(data.donations);
                renderRecentDonations(data.donations);
                if (typeof updateCharts === 'function') updateCharts(data.donations);
                if (typeof renderReportAndImpact === 'function') renderReportAndImpact(data.donations);
            }
        })
        .catch(err => console.error("Error fetching donations:", err));

    // Initialize Pickup Map Picker
    window.initDonorPickupLocationPicker = function() {
        if (typeof LocationPicker === 'undefined') return;
        const mapEl = document.getElementById('donorPickupPickerMap');
        if (!mapEl) return;

        if (!window.donorPickupPicker) {
            let initialLat = 12.9784;
            let initialLng = 77.6408;

            if (user && user.lat && user.lng) {
                initialLat = parseFloat(user.lat);
                initialLng = parseFloat(user.lng);
            } else if (user && user.location && user.location.latitude) {
                initialLat = parseFloat(user.location.latitude);
                initialLng = parseFloat(user.location.longitude);
            }

            window.donorPickupPicker = new LocationPicker({
                containerId: 'donorPickupPickerMap',
                searchInputId: 'donorPickupSearchInput',
                resultsContainerId: 'donorPickupSearchResults',
                addressInputId: 'input-pickup-address1',
                latInputId: 'input-pickup-lat',
                lngInputId: 'input-pickup-lng',
                initialLat: initialLat,
                initialLng: initialLng,
                markerType: 'pickup',
                onLocationSelected: (loc) => {
                    const summaryEl = document.getElementById('summary-pickup-address');
                    if (summaryEl) summaryEl.textContent = loc.address;
                }
            });
            window.donorPickupPickerMap_picker = window.donorPickupPicker;
        }

        setTimeout(() => {
            if (window.donorPickupPicker && window.donorPickupPicker.map) {
                window.donorPickupPicker.map.invalidateSize();
            }
        }, 150);
    };

    // Auto init picker if step 2 is visible
    setTimeout(() => {
        window.initDonorPickupLocationPicker();
    }, 500);

    // 4. Handle Submit Donation
    const submitBtn = document.getElementById('btn-submit-donation');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            
            const pickupAddr1 = document.getElementById('input-pickup-address1')?.value.trim() || '';
            const searchAddr = document.getElementById('donorPickupSearchInput')?.value.trim() || '';
            const fallbackAddr = document.getElementById('pickup-address')?.value.trim() || '';
            const pickupAddress = pickupAddr1 || searchAddr || fallbackAddr || (user && user.address) || '';
            
            const pickupDate = document.getElementById('pickup-date')?.value || new Date().toISOString().split('T')[0];
            const pickupTime = document.getElementById('pickup-time')?.value || '12:00 PM';
            const contactName = document.getElementById('input-contact-name')?.value.trim() || document.getElementById('contact-name')?.value.trim() || user.name || 'Donor';
            const contactPhone = document.getElementById('input-contact-phone')?.value.trim() || document.getElementById('contact-phone')?.value.trim() || (user && user.phone) || '';

            // Read latitude and longitude directly from Pickup Details input fields
            let latVal = parseFloat(document.getElementById('input-pickup-lat')?.value);
            let lngVal = parseFloat(document.getElementById('input-pickup-lng')?.value);

            if (isNaN(latVal) || isNaN(lngVal)) {
                if (user && user.lat && user.lng) {
                    latVal = parseFloat(user.lat);
                    lngVal = parseFloat(user.lng);
                } else if (user && user.location && user.location.latitude) {
                    latVal = parseFloat(user.location.latitude);
                    lngVal = parseFloat(user.location.longitude);
                } else {
                    latVal = 12.9784;
                    lngVal = 77.6408;
                }
            }

            const itemsPayload = (typeof currentDonationItems !== 'undefined' && currentDonationItems && currentDonationItems.length > 0) 
                ? currentDonationItems 
                : [
                    {
                        name: "Food Item", 
                        category: "Cooked Food",
                        quantity: 10,
                        unit: "kg"
                    }
                ];

            const payload = {
                donor_id: donorId,
                items: itemsPayload,
                pickup_location: {
                    address: pickupAddress,
                    latitude: latVal,
                    longitude: lngVal
                },
                pickup_details: {
                    address: pickupAddress,
                    date: pickupDate,
                    time: pickupTime,
                    contact_name: contactName,
                    contact_phone: contactPhone,
                    lat: latVal,
                    lng: lngVal
                }
            };

            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';

            fetch(`${API_BASE}/donations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    alert(data.message || "Donation successfully created!");
                    localStorage.removeItem('donation_draft');
                    window.location.reload();
                } else {
                    alert("Error: " + data.message);
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Submit Donation';
                }
            })
            .catch(err => {
                console.error("Error submitting donation:", err);
                alert("Network error while submitting donation.");
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit Donation';
            });
        });
    }
});

function updateDashboardStats(stats) {
    const totalDonationsEl = document.getElementById('stat-total-donations');
    const overviewCenterEl = document.getElementById('overview-total-donations-center');
    const totalFoodEl = document.getElementById('stat-total-food');
    const impactEl = document.getElementById('stat-impact');

    if (totalDonationsEl) totalDonationsEl.textContent = stats.total_donations;
    if (overviewCenterEl) overviewCenterEl.textContent = stats.total_donations;
    if (totalFoodEl) totalFoodEl.textContent = `${stats.total_kg} kg`;
    if (impactEl) impactEl.textContent = stats.people_impacted;

    // Update Impact & Reports widgets
    const impactSidebarFood = document.getElementById('impact-sidebar-food');
    const impactSidebarPeople = document.getElementById('impact-sidebar-people');
    const impactSidebarDonations = document.getElementById('impact-sidebar-donations');

    if (impactSidebarFood) impactSidebarFood.textContent = `${stats.total_kg} kg`;
    if (impactSidebarPeople) impactSidebarPeople.textContent = stats.people_impacted;
    if (impactSidebarDonations) impactSidebarDonations.textContent = stats.total_donations;
}

function updateCharts(donations) {
    if (!donations || !Array.isArray(donations)) return;

    // 1. Update Donut Chart (Status)
    let completed = 0;
    let pending = 0;
    let cancelled = 0;
    
    donations.forEach(d => {
        const s = (d.status || 'Pending').toLowerCase();
        if (s.includes('complet')) completed++;
        else if (s.includes('cancel')) cancelled++;
        else pending++;
    });

    const total = completed + pending + cancelled;
    const perc = (val) => total > 0 ? Math.round((val/total)*100) : 0;
    
    const elCompleted = document.getElementById('overview-completed');
    if (elCompleted) elCompleted.textContent = `${completed} (${perc(completed)}%)`;
    
    const elPending = document.getElementById('overview-pending');
    if (elPending) elPending.textContent = `${pending} (${perc(pending)}%)`;
    
    const elCancelled = document.getElementById('overview-cancelled');
    if (elCancelled) elCancelled.textContent = `${cancelled} (${perc(cancelled)}%)`;
    
    if (window.donorDonutChart) {
        window.donorDonutChart.data.datasets[0].data = [completed, pending, cancelled];
        window.donorDonutChart.update();
    }
    
    // 2. Update Bar Chart (Food Quantity per Day of Week)
    // Indexes: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
    const dayTotals = [0, 0, 0, 0, 0, 0, 0];
    
    donations.forEach(d => {
        if (!d.created_at) return;
        const dObj = new Date(d.created_at);
        let dayIdx = dObj.getDay() - 1;
        if (dayIdx === -1) dayIdx = 6; // Sunday
        
        const qty = d.items ? d.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0) : 0;
        dayTotals[dayIdx] += qty;
    });
    
    if (window.donorBarChart) {
        window.donorBarChart.data.datasets[0].data = dayTotals;
        // Dynamically update max scale based on data
        const maxTotal = Math.max(...dayTotals, 10);
        window.donorBarChart.options.scales.y.max = Math.ceil(maxTotal / 10) * 10;
        window.donorBarChart.update();
    }
}

function renderDonationsTable(donations) {
    const tbody = document.getElementById('donations-table-body');
    if (!tbody) return;

    tbody.innerHTML = ''; // Clear static content

    // 1. Calculate Filter Counts & Summaries
    let completedCount = 0;
    let pickedUpCount = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;
    let totalKg = 0;

    if (donations && Array.isArray(donations)) {
        donations.forEach(donation => {
            const s = (donation.status || 'Pending').toLowerCase();
            if (s.includes('complet')) completedCount++;
            if (s.includes('picked')) pickedUpCount++;
            if (s.includes('deliver')) deliveredCount++;
            if (s.includes('cancel')) cancelledCount++;

            if (donation.items) {
                donation.items.forEach(i => totalKg += Number(i.quantity || 0));
            }
        });
    }

    const elAll = document.getElementById('count-all-donations');
    if (elAll) elAll.textContent = donations ? donations.length : 0;
    
    const elComp = document.getElementById('count-completed-donations');
    if (elComp) elComp.textContent = completedCount;

    const elPick = document.getElementById('count-picked-up-donations');
    if (elPick) elPick.textContent = pickedUpCount;

    const elDel = document.getElementById('count-delivered-donations');
    if (elDel) elDel.textContent = deliveredCount;

    const elCanc = document.getElementById('count-cancelled-donations');
    if (elCanc) elCanc.textContent = cancelledCount;

    // Update pagination info
    const pageInfo = document.getElementById('donations-pagination-info');
    if (pageInfo) {
        pageInfo.textContent = donations && donations.length > 0 ? `Showing 1 to ${donations.length} of ${donations.length} donations` : `Showing 0 of 0 donations`;
    }

    // Update Sidebar Widgets
    const sbDonations = document.getElementById('sidebar-total-donations');
    if (sbDonations) sbDonations.textContent = donations ? donations.length : 0;

    const sbFood = document.getElementById('sidebar-total-food');
    if (sbFood) sbFood.innerHTML = `${totalKg} <span style="font-size:13px; font-weight:500;">kg</span>`;

    const sbPeople = document.getElementById('sidebar-people-fed');
    if (sbPeople) sbPeople.textContent = totalKg * 4;

    const sbCO2 = document.getElementById('sidebar-total-co2');
    if (sbCO2) sbCO2.innerHTML = `${(totalKg * 2.5).toFixed(1)} <span style="font-size:13px; font-weight:500;">kg</span>`;

    if (!donations || donations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">No donations found. Create one to get started!</td></tr>`;
        return;
    }

    donations.forEach(donation => {
        // Map status to styling
        let statusBadge = '';
        let rowDataAttr = '';
        if (donation.status === 'Delivered') {
            statusBadge = `<span style="display:inline-flex; align-items:center; gap:6px; background:#dcfce7; color:#166534; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600;"><i class="fa-regular fa-circle-check"></i> Delivered</span>`;
            rowDataAttr = `data-status="delivered" data-completed="true"`;
        } else if (donation.status === 'Picked Up') {
            statusBadge = `<span style="display:inline-flex; align-items:center; gap:6px; background:#eff6ff; color:#1d4ed8; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600;"><i class="fa-solid fa-truck-fast"></i> Picked Up</span>`;
            rowDataAttr = `data-status="picked-up" data-completed="false"`;
        } else if (donation.status === 'Cancelled') {
            statusBadge = `<span style="display:inline-flex; align-items:center; gap:6px; background:#fee2e2; color:#b91c1c; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600;"><i class="fa-regular fa-circle-xmark"></i> Cancelled</span>`;
            rowDataAttr = `data-status="cancelled" data-completed="false"`;
        } else {
            statusBadge = `<span style="display:inline-flex; align-items:center; gap:6px; background:#fef3c7; color:#b45309; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600;"><i class="fa-regular fa-clock"></i> Pending</span>`;
            rowDataAttr = `data-status="pending" data-completed="false"`;
        }

        // Get first item name for display
        const firstItem = donation.items && donation.items.length > 0 ? donation.items[0] : { name: "Donation Package", category: "Mixed" };
        const totalItems = donation.items ? donation.items.length : 0;
        
        let iconOrImageHtml = `<i class="fa-solid fa-box"></i>`;
        if (firstItem.photo) {
            iconOrImageHtml = `<img src="${firstItem.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" alt="${firstItem.name}">`;
        }
        
        let totalQty = 0;
        let qtyUnit = 'items';
        if (donation.items) {
             donation.items.forEach(i => totalQty += Number(i.quantity || 0));
             qtyUnit = donation.items[0]?.unit || 'items';
        }

        const dateObj = new Date(donation.created_at);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const tr = document.createElement('tr');
        tr.className = 'history-row';
        tr.style.cssText = 'border-bottom:1px solid var(--dash-border); transition:background 0.2s;';
        tr.onmouseover = function() { this.style.background='#f8fafc'; };
        tr.onmouseout = function() { this.style.background='transparent'; };
        let cancelBtnHtml = '';
        if (donation.status !== 'Delivered' && donation.status !== 'Cancelled') {
            cancelBtnHtml = `<button class="btn btn-secondary" onclick="cancelDonation('${donation._id}')" style="padding:6px 12px; font-size:12px; border:1px solid #ef4444; color:#ef4444; background:#fff; cursor:pointer; font-weight:600;"><i class="fa-solid fa-ban" style="margin-right:4px;"></i> Cancel</button>`;
        }

        tr.innerHTML = `
            <td style="padding:16px 8px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div style="width:40px; height:40px; border-radius:8px; background:var(--dash-primary-light); color:var(--dash-primary); display:flex; align-items:center; justify-content:center; font-size:18px;">
                        ${iconOrImageHtml}
                    </div>
                    <div>
                        <p style="margin:0; font-size:14px; font-weight:700; color:var(--dash-text-main);">${firstItem.name} ${totalItems > 1 ? `+${totalItems-1} more` : ''}</p>
                        <p style="margin:2px 0 0 0; font-size:12px; color:var(--dash-text-muted);">${firstItem.category}</p>
                    </div>
                </div>
            </td>
            <td style="padding:16px 8px; font-size:13px; font-weight:700; color:#16a34a;">${donation._id.substring(0, 8).toUpperCase()}</td>
            <td style="padding:16px 8px; font-size:13px;">
                <p style="margin:0; font-weight:500; color:var(--dash-text-main);">${dateStr}</p>
                <p style="margin:2px 0 0 0; color:var(--dash-text-muted);">${timeStr}</p>
            </td>
            <td style="padding:16px 8px; font-size:13px;">
                <p style="margin:0; font-weight:700; color:var(--dash-text-main);">${totalQty} ${qtyUnit}</p>
            </td>
            <td style="padding:16px 8px;">
                ${statusBadge}
            </td>
            <td style="padding:16px 8px; font-size:13px;">
                <p style="margin:0; font-weight:500; color:var(--dash-text-main);">${donation.pickup_details?.address || 'N/A'}</p>
            </td>
            <td style="padding:16px 8px; text-align:right;">
                <div style="display:flex; justify-content:flex-end; gap:8px;">
                    <button class="btn btn-secondary" onclick="openDonationDetailModal('${donation._id}')" style="padding:6px 12px; font-size:12px; border:1px solid #10b981; color:#10b981; background:#fff; cursor:pointer; font-weight:600;"><i class="fa-regular fa-eye" style="margin-right:4px;"></i> View</button>
                    ${cancelBtnHtml}
                </div>
            </td>
        `;
        
        // Add data attributes for filters
        const statusText = donation.status || 'Pending';
        tr.setAttribute('data-status', statusText.toLowerCase().replace(' ', '-'));
        tr.setAttribute('data-completed', statusText === 'Delivered' ? 'true' : 'false');
        
        tbody.appendChild(tr);
    });
}

// ============================================
// CANCEL DONATION FUNCTION
// ============================================
window.cancelDonation = function(donationId) {
    if (!confirm("Are you sure you want to cancel this donation?")) {
        return;
    }

    fetch(`${API_BASE}/donations/cancel/${donationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert(data.message || "Donation cancelled successfully.");
            
            // Close modal if open
            const modal = document.getElementById('donation-summary-modal');
            if (modal) modal.style.display = 'none';

            // Refresh user donations list & stats
            let userStr = localStorage.getItem('jivahar_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                fetch(`${API_BASE}/donations/${user._id}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d.success) {
                            window.userDonations = d.donations;
                            renderDonationsTable(d.donations);
                        }
                    });
            }
        } else {
            alert("Unable to cancel donation: " + (data.message || "Unknown error"));
        }
    })
    .catch(err => {
        console.error("Error cancelling donation:", err);
        alert("Error connecting to server to cancel donation.");
    });
};

// ============================================
// DONATION DETAIL CARD SUMMARY MODAL LOGIC
// ============================================
window.openDonationDetailModal = function(donationId) {
    const donations = window.userDonations || [];
    const donation = donations.find(d => d._id === donationId);
    if (!donation) return;

    const modal = document.getElementById('donation-summary-modal');
    if (!modal) return;

    // 1. ID & Status Badge
    const shortId = donation._id ? donation._id.substring(0, 8).toUpperCase() : 'N/A';
    document.getElementById('modal-donation-id').textContent = `Donation #${shortId}`;

    let statusBadgeHtml = '';
    const status = donation.status || 'Pending';
    if (status === 'Delivered') {
        statusBadgeHtml = `<span style="background:#dcfce7; color:#166534; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700;"><i class="fa-regular fa-circle-check"></i> Delivered</span>`;
    } else if (status === 'Picked Up') {
        statusBadgeHtml = `<span style="background:#eff6ff; color:#1d4ed8; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700;"><i class="fa-solid fa-truck-fast"></i> Picked Up</span>`;
    } else if (status === 'Cancelled') {
        statusBadgeHtml = `<span style="background:#fee2e2; color:#b91c1c; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700;"><i class="fa-regular fa-circle-xmark"></i> Cancelled</span>`;
    } else {
        statusBadgeHtml = `<span style="background:#fef3c7; color:#b45309; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:700;"><i class="fa-regular fa-clock"></i> Pending</span>`;
    }
    document.getElementById('modal-donation-status-badge').innerHTML = statusBadgeHtml;

    // Handle Cancel button inside modal footer
    const modalCancelBtn = document.getElementById('modal-cancel-donation-btn');
    if (modalCancelBtn) {
        if (status !== 'Delivered' && status !== 'Cancelled') {
            modalCancelBtn.style.display = 'inline-flex';
            modalCancelBtn.onclick = function() { cancelDonation(donation._id); };
        } else {
            modalCancelBtn.style.display = 'none';
        }
    }

    // 2. Date
    if (donation.created_at) {
        const dObj = new Date(donation.created_at);
        document.getElementById('modal-donation-date').textContent = `Created on ${dObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${dObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        document.getElementById('modal-donation-date').textContent = 'Date: N/A';
    }

    // 3. Quick Stats
    let totalQty = 0;
    let qtyUnit = 'kg';
    if (donation.items && Array.isArray(donation.items)) {
        donation.items.forEach(item => {
            totalQty += Number(item.quantity || 0);
            if (item.unit) qtyUnit = item.unit;
        });
    }

    document.getElementById('modal-stat-qty').textContent = `${totalQty} ${qtyUnit}`;
    document.getElementById('modal-stat-meals').textContent = `${totalQty * 4} Meals`;
    document.getElementById('modal-stat-co2').textContent = `${(totalQty * 2.5).toFixed(1)} kg`;

    const cascade = donation.notification_cascade || {};
    const activeTier = cascade.active_tier || 1;
    const activeRadius = cascade.active_radius || (activeTier === 1 ? '15 km' : '25 km');
    document.getElementById('modal-stat-tier').textContent = `Tier ${activeTier} (${activeRadius})`;

    // 4. Food Items List
    const itemsListContainer = document.getElementById('modal-food-items-list');
    itemsListContainer.innerHTML = '';

    if (donation.items && donation.items.length > 0) {
        donation.items.forEach(item => {
            let imgHtml = `<div style="width:48px; height:48px; border-radius:8px; background:#dcfce7; color:#10b981; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0;"><i class="fa-solid fa-utensils"></i></div>`;
            if (item.photo) {
                imgHtml = `<img src="${item.photo}" class="modal-item-img" alt="${item.name}">`;
            }

            const itemDiv = document.createElement('div');
            itemDiv.className = 'modal-item-card';
            itemDiv.innerHTML = `
                ${imgHtml}
                <div style="flex-grow:1;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <strong style="font-size:14px; color:#1e293b;">${item.name}</strong>
                        <span style="font-size:13px; font-weight:700; color:#10b981;">${item.quantity} ${item.unit || 'kg'}</span>
                    </div>
                    <div style="font-size:12px; color:#64748b; margin-top:2px;">
                        <span>Category: ${item.category || 'Food Item'}</span>
                        ${item.expiry ? ` • <span style="color:#e11d48;">Expires: ${item.expiry}</span>` : ''}
                    </div>
                </div>
            `;
            itemsListContainer.appendChild(itemDiv);
        });
    } else {
        itemsListContainer.innerHTML = '<p style="font-size:13px; color:#94a3b8; margin:0;">No explicit food items listed.</p>';
    }

    // 5. Pickup & Contact Details
    const pickup = donation.pickup_details || {};
    document.getElementById('modal-pickup-address').textContent = pickup.address || 'N/A';
    
    let userStr = localStorage.getItem('jivahar_user');
    let defaultUser = userStr ? JSON.parse(userStr) : {};

    let contactStr = pickup.contact_name || defaultUser.name || 'Donor';
    if (pickup.contact_phone || defaultUser.phone) contactStr += ` (${pickup.contact_phone || defaultUser.phone})`;
    document.getElementById('modal-pickup-contact').textContent = contactStr;

    let timeStr = 'Immediate Pickup';
    if (pickup.date || pickup.time) {
        timeStr = [pickup.date, pickup.time].filter(Boolean).join(' at ');
    }
    document.getElementById('modal-pickup-time').textContent = timeStr;

    // 6. NGO Reach & Cascade
    const cascadeContainer = document.getElementById('modal-cascade-container');
    const currentlyNotified = cascade.currently_notified || [];
    
    let cascadeHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-weight:600; color:#475569;">Active Notification Radius:</span>
            <span style="background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:6px; font-size:12px; font-weight:700;">${activeRadius} (${activeTier === 1 ? 'Priority Tier 1' : 'Cascade Tier 2'})</span>
        </div>
    `;

    if (currentlyNotified.length > 0) {
        cascadeHtml += `<div style="font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">Notified Registered NGOs (${currentlyNotified.length}):</div>`;
        cascadeHtml += `<div style="display:flex; flex-direction:column; gap:6px;">`;
        currentlyNotified.forEach(ngo => {
            cascadeHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; padding:8px 10px; border-radius:6px; border:1px solid #e2e8f0; font-size:12px;">
                    <div>
                        <strong style="color:#0f172a;"><i class="fa-solid fa-building-ngo" style="color:#2563eb; margin-right:4px;"></i>${ngo.name}</strong>
                        ${ngo.distance_km ? `<span style="color:#64748b; margin-left:6px;">(${ngo.distance_km} km away)</span>` : ''}
                    </div>
                    ${ngo.phone ? `<span style="color:#2563eb; font-weight:600;"><i class="fa-solid fa-phone" style="font-size:10px; margin-right:2px;"></i>${ngo.phone}</span>` : ''}
                </div>
            `;
        });
        cascadeHtml += `</div>`;
    } else {
        cascadeHtml += `<p style="font-size:12px; color:#64748b; margin:4px 0 0 0;">Searching for registered NGOs within ${activeRadius}...</p>`;
    }

    cascadeContainer.innerHTML = cascadeHtml;

    // Show modal
    modal.style.display = 'flex';
};

// Modal Close & Print Listeners
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('donation-summary-modal');
    const closeBtn1 = document.getElementById('close-donation-modal-btn');
    const closeBtn2 = document.getElementById('close-donation-modal-footer-btn');
    const printBtn = document.getElementById('print-donation-summary-btn');

    const closeModal = () => { if (modal) modal.style.display = 'none'; };

    if (closeBtn1) closeBtn1.addEventListener('click', closeModal);
    if (closeBtn2) closeBtn2.addEventListener('click', closeModal);

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
});

function renderRecentDonations(donations) {
    const list = document.getElementById('recent-donations-list');
    if (!list) return;

    list.innerHTML = '';
    
    // Show up to 4 recent
    const recent = donations.slice(0, 4);
    
    if (recent.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#94a3b8; font-size:13px;">No recent donations</p>';
        return;
    }

    recent.forEach(donation => {
        const firstItem = donation.items && donation.items.length > 0 ? donation.items[0] : { name: "Donation Package" };
        const itemName = firstItem.name;
        
        let iconOrImageHtml = `<i class="fa-solid fa-box-open"></i>`;
        if (firstItem.photo) {
            iconOrImageHtml = `<img src="${firstItem.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:12px;" alt="${itemName}">`;
        }
        
        let statusColor = '#f59e0b';
        if(donation.status === 'Delivered') statusColor = '#10b981';
        if(donation.status === 'Picked Up') statusColor = '#3b82f6';
        if(donation.status === 'Cancelled') statusColor = '#ef4444';

        const dateObj = new Date(donation.created_at);
        const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const html = `
            <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
                <div style="width:48px; height:48px; border-radius:12px; background:var(--dash-primary-light); color:var(--dash-primary); display:flex; align-items:center; justify-content:center; font-size:20px;">
                    ${iconOrImageHtml}
                </div>
                <div style="flex:1;">
                    <h5 style="margin:0; font-size:14px; font-weight:700;">${itemName}</h5>
                    <p style="margin:2px 0 0 0; font-size:12px; color:var(--dash-text-muted);">ID: ${donation._id.substring(0,8).toUpperCase()} • ${dateStr}</p>
                </div>
                <div style="text-align:right;">
                    <span style="font-size:12px; font-weight:700; color:${statusColor};">${donation.status}</span>
                </div>
            </div>
        `;
        list.insertAdjacentHTML('beforeend', html);
    });
}


// --- REAL-TIME DONATION FORM BINDING ---

let currentDonationItems = [];

const saveDraft = () => {
    const draft = {
        items: currentDonationItems,
        form: {
            address1: document.getElementById('input-pickup-address1')?.value || '',
            address2: document.getElementById('input-pickup-address2')?.value || '',
            city: document.getElementById('input-pickup-city')?.value || '',
            pincode: document.getElementById('input-pickup-pincode')?.value || '',
            cName: document.getElementById('input-contact-name')?.value || '',
            cPhone: document.getElementById('input-contact-phone')?.value || '',
            transport: document.querySelector('input[name="transport"]:checked')?.value || 'none'
        }
    };
    localStorage.setItem('donation_draft', JSON.stringify(draft));
};


document.addEventListener('DOMContentLoaded', () => {
    // 1. Pickup Details Binding
    const updateAddressSummary = () => {
        const addr1 = document.getElementById('input-pickup-address1')?.value || '';
        const city = document.getElementById('input-pickup-city')?.value || '';
        const summary = [addr1, city].filter(Boolean).join(', ');
        document.getElementById('summary-pickup-address').textContent = summary || 'Not set';
    };
    
    ['input-pickup-address1', 'input-pickup-address2', 'input-pickup-city', 'input-pickup-pincode'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updateAddressSummary);
    });


    // 3. Contact Binding
    const updateContactSummary = () => {
        const name = document.getElementById('input-contact-name')?.value || '';
        const phone = document.getElementById('input-contact-phone')?.value || '';
        const summary = [name, phone].filter(Boolean).join(' • ');
        document.getElementById('summary-pickup-contact').textContent = summary || 'Not set';
    };

    ['input-contact-name', 'input-contact-phone'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', updateContactSummary);
    });

    // Set Date Picker Constraints Globally
    const now = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const pad = (n) => n.toString().padStart(2, '0');
    
    const formatDateTime = (date) => {
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    
    const formatDate = (date) => {
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
    };

    const todayStart = new Date(now);
    todayStart.setHours(0,0,0,0);
    
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23,59,0,0);
    
    // Apply constraints to all datetime-local inputs
    document.querySelectorAll('input[type="datetime-local"]').forEach(input => {
        input.min = formatDateTime(todayStart);
        input.max = formatDateTime(tomorrowEnd);
    });

    // Apply constraints to all date inputs
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.min = formatDate(todayStart);
        input.max = formatDate(tomorrowEnd);
    });

    // 4. Transport Binding
    const updateTransportSummary = (e) => {
        if(e.target.checked) {
            let text = e.target.value.replace('_', ' ');
            text = text.charAt(0).toUpperCase() + text.slice(1) + (text === 'none' ? '' : ' Suitable');
            document.getElementById('summary-transport').textContent = text;
        }
    };

    const radios = document.querySelectorAll('input[name="transport"]');
    radios.forEach(r => r.addEventListener('change', updateTransportSummary));

    // Bind saveDraft to all form inputs
    document.querySelectorAll('#step-pickup-content input, #step-contact-content input, #step-transport-content input').forEach(el => {
        el.addEventListener('input', saveDraft);
        el.addEventListener('change', saveDraft);
    });

    // Geolocation logic
    const btnLiveLoc = document.getElementById('btn-live-location');
    if (btnLiveLoc) {
        btnLiveLoc.addEventListener('click', () => {
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by your browser.');
                return;
            }
            btnLiveLoc.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
            btnLiveLoc.disabled = true;
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    
                    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`)
                        .then(res => res.json())
                        .then(data => {
                            const addr = data.address;
                            if (addr) {
                                const road = addr.road || addr.suburb || '';
                                const city = addr.city || addr.town || addr.village || addr.county || '';
                                const postcode = addr.postcode || '';
                                
                                const inputAddr1 = document.getElementById('input-pickup-address1');
                                const inputCity = document.getElementById('input-pickup-city');
                                const inputPincode = document.getElementById('input-pickup-pincode');
                                
                                if (inputAddr1) inputAddr1.value = road || data.display_name.split(',')[0];
                                if (inputCity) inputCity.value = city;
                                if (inputPincode) inputPincode.value = postcode;
                                
                                updateAddressSummary();
                                saveDraft();
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            alert("Failed to reverse geocode location.");
                        })
                        .finally(() => {
                            btnLiveLoc.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use Live Location';
                            btnLiveLoc.disabled = false;
                        });
                },
                (error) => {
                    alert('Error getting location: ' + error.message);
                    btnLiveLoc.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Use Live Location';
                    btnLiveLoc.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    }

    // Load Draft
    const loadDraft = () => {
        const draftStr = localStorage.getItem('donation_draft');
        if (!draftStr) return;
        try {
            const draft = JSON.parse(draftStr);
            if (draft.items) {
                currentDonationItems = draft.items;
                renderFoodItems();
                saveDraft();
            }
            if (draft.form) {
                const setVal = (id, val) => {
                    const el = document.getElementById(id);
                    if (el) el.value = val || '';
                };
                setVal('input-pickup-address1', draft.form.address1);
                setVal('input-pickup-address2', draft.form.address2);
                setVal('input-pickup-city', draft.form.city);
                setVal('input-pickup-pincode', draft.form.pincode);
                setVal('input-contact-name', draft.form.cName);
                setVal('input-contact-phone', draft.form.cPhone);
                
                const trRadio = document.querySelector(`input[name="transport"][value="${draft.form.transport}"]`);
                if (trRadio) trRadio.checked = true;

                updateAddressSummary();
                updateContactSummary();
                
                if (trRadio) {
                    let text = trRadio.value.replace('_', ' ');
                    text = text.charAt(0).toUpperCase() + text.slice(1) + (text === 'none' ? '' : ' Suitable');
                    const el = document.getElementById('summary-transport');
                    if (el) el.textContent = text;
                }
            }
        } catch (e) {
            console.error("Draft load error", e);
        }
    };
    loadDraft();


    // 5. Add Food Item Logic
    const btnAddItem = document.getElementById('btn-add-food-item');
    if(btnAddItem) {
        btnAddItem.addEventListener('click', (e) => {
            const nameEl = document.getElementById('add-item-name');
            const categoryEl = document.getElementById('add-item-category');
            const typeEl = document.getElementById('add-item-type');
            const qtyEl = document.getElementById('add-item-qty');
            const unitEl = document.getElementById('add-item-unit');
            const pkgsEl = document.getElementById('add-item-pkgs');
            const prepEl = document.getElementById('add-item-prep');
            const bestEl = document.getElementById('add-item-best');
            const pkgTypeEl = document.getElementById('add-item-pkg-type');

            if(!nameEl || !nameEl.value.trim() || 
               !categoryEl || categoryEl.value.includes('Select') || 
               !typeEl || typeEl.value.includes('Select') ||
               !qtyEl || !qtyEl.value || 
               !unitEl || unitEl.value.includes('Select') || 
               !pkgsEl || !pkgsEl.value ||
               !prepEl || !prepEl.value || 
               !bestEl || !bestEl.value || 
               !pkgTypeEl || pkgTypeEl.value.includes('Select')) {
                alert('Please fill in all mandatory fields correctly.');
                return;
            }

            const qty = Number(qtyEl.value);
            const pkgs = Number(pkgsEl.value);
            
            if (qty < 1 || pkgs < 1) {
                alert('Quantity and Number of Packages must be at least 1.');
                return;
            }

            const prepDate = new Date(prepEl.value);
            const bestDate = new Date(bestEl.value);
            const now = new Date();
            
            // Set 'now' to start of today for past date validation
            now.setHours(0,0,0,0);
            
            if (prepDate < now) {
                alert('Prepared time cannot be in the past.');
                return;
            }

            const diffHours = (bestDate - prepDate) / (1000 * 60 * 60);
            if (diffHours <= 0 || diffHours > 24) {
                alert('Best before date must be after the prepared time and within 24 hours.');
                return;
            }

            const name = nameEl.value.trim();
            const category = categoryEl.value;
            const type = typeEl.value;
            const unit = unitEl.value;
            const prep = prepEl.value;
            
            // Add to array
            const item = { name, category, type, quantity: qty, unit, packages: pkgs, prepDate: prep };
            
            const finishAdding = (finalItem) => {
                currentDonationItems.push(finalItem);
                
                // Re-render UI
                renderFoodItems();
                saveDraft();
                
                // Clear form
                nameEl.value = '';
                qtyEl.value = '';
                pkgsEl.value = '';
                prepEl.value = '';
                bestEl.value = '';
                categoryEl.selectedIndex = 0;
                typeEl.selectedIndex = 0;
                unitEl.selectedIndex = 0;
                pkgTypeEl.selectedIndex = 0;
                
                // Also reset photo upload preview if exists
                const photoText = document.getElementById('photo-upload-text');
                const photoContainer = document.getElementById('photo-upload-container');
                const photoInput = document.getElementById('add-item-photo');
                
                if(photoInput) photoInput.value = '';
                if (photoContainer && photoText) {
                    photoText.innerText = 'Upload Photo';
                    photoContainer.style.backgroundImage = 'none';
                    const cam = photoContainer.querySelector('.fa-camera');
                    if (cam) {
                        cam.style.opacity = '1';
                        cam.style.color = '';
                        cam.style.textShadow = 'none';
                    }
                    photoText.style.color = '';
                    photoText.style.background = 'none';
                }
            };

            const photoInput = document.getElementById('add-item-photo');
            if (photoInput && photoInput.files && photoInput.files[0]) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    item.photo = ev.target.result;
                    finishAdding(item);
                    saveDraft();
                };
                reader.readAsDataURL(photoInput.files[0]);
            } else {
                finishAdding(item);
                    saveDraft();
            }
        });
    }
});

function renderFoodItems() {
    const mainList = document.getElementById('dynamic-food-list');
    if (mainList) {
        mainList.innerHTML = '';
        currentDonationItems.forEach((item, index) => {
            let prepFormatted = item.prepDate ? new Date(item.prepDate).toLocaleString() : 'N/A';
            let iconOrImage = item.photo 
                ? `<img src="${item.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" alt="${item.name}">`
                : `<i class="fa-solid fa-bowl-food"></i>`;

            mainList.innerHTML += `
                <div class="food-item-row" style="display:flex; gap:16px; align-items:center; background:#fff; border:1px solid var(--dash-border); border-radius:12px; padding:16px; margin-bottom:12px;">
                    <div style="width:64px; height:64px; border-radius:8px; background:var(--dash-primary-light); color:var(--dash-primary); display:flex; align-items:center; justify-content:center; font-size:24px;">
                        ${iconOrImage}
                    </div>
                    <div style="flex:1;">
                        <h4 style="margin:0; font-size:15px; font-weight:700;">${item.name}</h4>
                        <div style="display:flex; gap:8px; margin:4px 0;">
                            <span class="badge badge-green" style="font-size:11px;">${item.category}</span>
                            <span class="badge badge-green" style="font-size:11px;">${item.type}</span>
                        </div>
                        <div style="font-size:13px; font-weight:600;">${item.quantity} ${item.unit} <span style="color:#64748b; font-weight:400;">• ${item.packages} packages</span></div>
                    </div>
                </div>
            `;
        });
    }

    // Update summary list
    const summaryList = document.querySelector('.compact-summary-list');
    if (summaryList) {
        summaryList.innerHTML = '';
        let totalWeight = 0;
        let totalPackages = 0;
        
        currentDonationItems.forEach(item => {
            totalWeight += item.quantity;
            totalPackages += item.packages;
            
            summaryList.innerHTML += `
                <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">
                    <div style="width:32px; height:32px; border-radius:6px; background:var(--dash-primary-light); color:var(--dash-primary); display:flex; align-items:center; justify-content:center; font-size:12px;">
                        ${item.photo ? `<img src="${item.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;" alt="${item.name}">` : `<i class="fa-solid fa-bowl-food"></i>`}
                    </div>
                    <div>
                        <h5 style="margin:0; font-size:12px; font-weight:600;">${item.name}</h5>
                        <p style="margin:0; font-size:11px; color:var(--dash-text-muted);">${item.quantity} ${item.unit} • ${item.packages} pkgs</p>
                    </div>
                </div>
            `;
        });
          // Update summary totals
        const weightEl = document.getElementById('summary-total-weight');
        const pkgEl = document.getElementById('summary-total-packages');
        const countEl = document.getElementById('summary-item-count');
        
        if (weightEl) weightEl.textContent = `~${totalWeight} kg`; 
        if (pkgEl) pkgEl.textContent = totalPackages;
        if (countEl) countEl.textContent = `${currentDonationItems.length} Items`;
    }
}

function renderReportAndImpact(donations) {
    const tbody = document.getElementById('impact-ngo-table-body');
    const highlightsList = document.getElementById('impact-highlights-list');
    
    let totalKg = 0;
    const catTotals = { 'Cooked Food': 0, 'Fruits': 0, 'Bakery': 0, 'Snacks': 0, 'Others': 0 };

    if (donations && Array.isArray(donations)) {
        donations.forEach(d => {
            if (d.items) {
                d.items.forEach(item => {
                    const qty = parseFloat(item.quantity) || 0;
                    totalKg += qty;
                    const cat = item.category || 'Cooked Food';
                    if (catTotals.hasOwnProperty(cat)) {
                        catTotals[cat] += qty;
                    } else {
                        catTotals['Others'] += qty;
                    }
                });
            }
        });
    }

    // 1. Update Top Metric Cards
    const impFood = document.getElementById('impact-total-food');
    if (impFood) impFood.textContent = `${totalKg} kg`;

    const impPeople = document.getElementById('impact-people-fed');
    if (impPeople) impPeople.textContent = totalKg * 4;

    const impCO2 = document.getElementById('impact-co2-saved');
    if (impCO2) impCO2.textContent = `${(totalKg * 2.5).toFixed(1)} kg`;

    const impWaste = document.getElementById('impact-waste-diverted');
    if (impWaste) impWaste.textContent = `${totalKg} kg`;

    // 2. Update Donut Chart & Category Breakdown
    const donutTotal = document.getElementById('category-donut-gradient');
    const donutText = document.getElementById('category-donut-total');
    if (donutText) donutText.textContent = `${totalKg} kg`;

    const getPerc = (val) => totalKg > 0 ? Math.round((val / totalKg) * 100) : 0;
    
    if (donutTotal) {
        const pCooked = getPerc(catTotals['Cooked Food']);
        const pFruits = getPerc(catTotals['Fruits']);
        const pBakery = getPerc(catTotals['Bakery']);
        const pSnacks = getPerc(catTotals['Snacks']);
        
        const c1 = pCooked;
        const c2 = c1 + pFruits;
        const c3 = c2 + pBakery;
        const c4 = c3 + pSnacks;

        donutTotal.style.background = `conic-gradient(
            #16a34a 0% ${c1}%,
            #f97316 ${c1}% ${c2}%,
            #8b5cf6 ${c2}% ${c3}%,
            #3b82f6 ${c3}% ${c4}%,
            #64748b ${c4}% 100%
        )`;
    }

    const elCooked = document.getElementById('cat-cooked-food');
    if (elCooked) elCooked.textContent = `${getPerc(catTotals['Cooked Food'])}% (${catTotals['Cooked Food']} kg)`;

    const elFruits = document.getElementById('cat-fruits');
    if (elFruits) elFruits.textContent = `${getPerc(catTotals['Fruits'])}% (${catTotals['Fruits']} kg)`;

    const elBakery = document.getElementById('cat-bakery');
    if (elBakery) elBakery.textContent = `${getPerc(catTotals['Bakery'])}% (${catTotals['Bakery']} kg)`;

    const elSnacks = document.getElementById('cat-snacks');
    if (elSnacks) elSnacks.textContent = `${getPerc(catTotals['Snacks'])}% (${catTotals['Snacks']} kg)`;

    const elOthers = document.getElementById('cat-others');
    if (elOthers) elOthers.textContent = `${getPerc(catTotals['Others'])}% (${catTotals['Others']} kg)`;

    // 3. Update Line Chart (Food Donated Over Time)
    if (window.donorImpactLineChart) {
        const now = new Date();
        const weekBuckets = [0, 0, 0, 0];
        const weekLabels = [];

        for (let i = 3; i >= 0; i--) {
            const end = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
            const start = new Date(end.getTime() - (6 * 24 * 60 * 60 * 1000));
            const startStr = `${start.toLocaleString('default', { month: 'short' })} ${start.getDate()}`;
            const endStr = `${end.toLocaleString('default', { month: 'short' })} ${end.getDate()}`;
            weekLabels.push(`${startStr} - ${endStr}`);
        }

        if (donations && Array.isArray(donations)) {
            donations.forEach(d => {
                const dDate = d.created_at ? new Date(d.created_at) : new Date();
                const diffDays = Math.floor((now - dDate) / (1000 * 60 * 60 * 24));
                const totalQty = d.items ? d.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0) : 0;
                
                if (diffDays >= 0 && diffDays < 7) weekBuckets[3] += totalQty;
                else if (diffDays >= 7 && diffDays < 14) weekBuckets[2] += totalQty;
                else if (diffDays >= 14 && diffDays < 21) weekBuckets[1] += totalQty;
                else if (diffDays >= 21 && diffDays < 28) weekBuckets[0] += totalQty;
            });
        }

        window.donorImpactLineChart.data.labels = weekLabels;
        window.donorImpactLineChart.data.datasets[0].data = weekBuckets;
        const maxTotal = Math.max(...weekBuckets, 10);
        window.donorImpactLineChart.options.scales.y.max = Math.ceil(maxTotal / 10) * 10;
        window.donorImpactLineChart.update();
    }

    // 3. Update Impact Table & Highlights
    if (!tbody || !highlightsList) return;
    
    tbody.innerHTML = '';
    highlightsList.innerHTML = '';

    if (!donations || donations.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:16px 24px; font-size:13px; text-align:center; color:var(--dash-text-muted);">No data available</td></tr>`;
        highlightsList.innerHTML = `<p style="font-size:12px; color:#666;">No data available.</p>`;
        return;
    }
    
    const tr = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid var(--dash-border);';
    tr.innerHTML = `
        <td style="padding:16px 24px;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:32px; height:32px; border-radius:50%; background:#f0fdf4; color:#16a34a; display:flex; align-items:center; justify-content:center; font-size:14px;"><i class="fa-solid fa-building-ngo"></i></div>
                <span style="font-size:13px; font-weight:700; color:var(--dash-text-main);">Local Community NGO</span>
            </div>
        </td>
        <td style="padding:16px 24px; font-size:13px; text-align:center; font-weight:600; color:var(--dash-text-main);">${totalKg} kg</td>
        <td style="padding:16px 24px; font-size:13px; text-align:center; color:var(--dash-text-muted);">${totalKg * 4}</td>
        <td style="padding:16px 24px; font-size:13px; text-align:center; font-weight:600; color:var(--dash-primary);">${donations.length}</td>
    `;
    tbody.appendChild(tr);
    
    highlightsList.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:12px;">
            <div style="width:24px; height:24px; border-radius:50%; background:#eff6ff; color:#3b82f6; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0;"><i class="fa-solid fa-star"></i></div>
            <div>
                <h5 style="margin:0 0 4px 0; font-size:13px; font-weight:700;">Top Contributor</h5>
                <p style="margin:0; font-size:12px; color:var(--dash-text-muted); line-height:1.5;">You are in the top 10% of donors in your area this month.</p>
            </div>
        </div>
        <div style="display:flex; align-items:flex-start; gap:12px;">
            <div style="width:24px; height:24px; border-radius:50%; background:#fefce8; color:#eab308; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0;"><i class="fa-solid fa-fire"></i></div>
            <div>
                <h5 style="margin:0 0 4px 0; font-size:13px; font-weight:700;">${donations.length} Donation Streak</h5>
                <p style="margin:0; font-size:12px; color:var(--dash-text-muted); line-height:1.5;">You've maintained a great donation streak!</p>
            </div>
        </div>
    `;
}


// DYNAMIC STEP 4 REVIEW DETAILS
window.updateReviewStep = function() {
    const items = (typeof currentDonationItems !== 'undefined' && currentDonationItems) ? currentDonationItems : [];
    const totalItemsEl = document.getElementById('review-total-items');
    const totalWeightEl = document.getElementById('review-total-weight');
    const locationEl = document.getElementById('review-pickup-address');
    const scheduleEl = document.getElementById('review-pickup-schedule');
    const contactEl = document.getElementById('review-pickup-contact');

    let totalQty = 0;
    items.forEach(i => totalQty += Number(i.quantity || 0));
    const unit = items.length > 0 ? (items[0].unit || 'kg') : 'kg';

    if (totalItemsEl) totalItemsEl.textContent = items.length > 0 ? String(items.length) : '0';
    if (totalWeightEl) totalWeightEl.textContent = items.length > 0 ? `${totalQty} ${unit} / ${items.length} package(s)` : '0 kg';

    const pickupAddr = document.getElementById('input-pickup-address1')?.value.trim() 
        || document.getElementById('donorPickupSearchInput')?.value.trim() 
        || (user && user.address) 
        || 'Not specified';
    if (locationEl) locationEl.textContent = pickupAddr;

    const date = document.getElementById('pickup-date')?.value || '';
    const time = document.getElementById('pickup-time')?.value || '';
    if (scheduleEl) scheduleEl.textContent = (date || time) ? `${date} • ${time}` : 'Not scheduled';

    const name = document.getElementById('input-contact-name')?.value.trim() || (user && user.name) || '';
    const phone = document.getElementById('input-contact-phone')?.value.trim() || (user && user.phone) || '';
    if (contactEl) contactEl.textContent = (name || phone) ? `${name} (${phone})` : 'Not specified';
};
