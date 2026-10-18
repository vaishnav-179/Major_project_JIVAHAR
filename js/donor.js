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


    // 5. YOLO Food Detection & Add Food Item Logic
    let currentUploadedPhotoDataUrl = null;
    const photoInput = document.getElementById('add-item-photo');
    const photoContainer = document.getElementById('photo-upload-container');
    const photoText = document.getElementById('photo-upload-text');
    const photoOptional = document.getElementById('photo-upload-optional');
    const yoloStatusBox = document.getElementById('yolo-detection-status');
    const foodNameInput = document.getElementById('add-item-name');

    if (photoInput) {
        photoInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            // 1. Show immediate preview thumbnail
            const reader = new FileReader();
            reader.onload = (ev) => {
                currentUploadedPhotoDataUrl = ev.target.result;
                if (photoContainer) {
                    photoContainer.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.5)), url(${currentUploadedPhotoDataUrl})`;
                    photoContainer.style.backgroundSize = 'cover';
                    photoContainer.style.backgroundPosition = 'center';
                }
                if (photoText) {
                    photoText.innerText = 'Change Uploaded Photo';
                    photoText.style.color = '#ffffff';
                    photoText.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
                }
                if (photoOptional) {
                    photoOptional.innerText = file.name;
                    photoOptional.style.color = '#e2e8f0';
                }
            };
            reader.readAsDataURL(file);

            // 2. Display loading state in YOLO status banner
            if (yoloStatusBox) {
                yoloStatusBox.style.display = 'block';
                yoloStatusBox.innerHTML = `
                    <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; color: #1e40af; font-size: 13px; display: flex; align-items: center; gap: 12px;">
                        <i class="fa-solid fa-spinner fa-spin" style="font-size: 18px; color: #2563eb;"></i>
                        <div>
                            <strong style="display:block;">Running YOLO Food Detection...</strong>
                            <span style="font-size:12px; opacity:0.85;">Analyzing uploaded photo with YOLO model from 'new project major'...</span>
                        </div>
                    </div>
                `;
            }

            // 3. Call backend API with multi-endpoint resolution
            try {
                const formData = new FormData();
                formData.append('image', file);

                const candidateEndpoints = [
                    (typeof API_BASE !== 'undefined' ? `${API_BASE}/ai/detect-food` : 'http://127.0.0.1:5000/api/ai/detect-food'),
                    'http://127.0.0.1:5000/api/ai/detect-food',
                    'http://localhost:5000/api/ai/detect-food',
                    '/api/ai/detect-food'
                ];

                let result = null;
                for (const url of candidateEndpoints) {
                    try {
                        const res = await fetch(url, {
                            method: 'POST',
                            body: formData
                        });
                        if (res.ok) {
                            result = await res.json();
                            if (result && result.success) break;
                        }
                    } catch (netErr) {
                        // Continue to next endpoint candidate
                    }
                }

                // Check whether food was actually detected
                if (!result || !result.success || !result.food_detected || !result.food_items || result.food_items.length === 0) {
                    window.currentDetectedFoodItems = [];
                    if (foodNameInput) foodNameInput.value = '';
                    
                    const singleQtyGroup = document.getElementById('single-item-quantity-group');
                    const multiQtyGroup = document.getElementById('multi-item-quantities-group');
                    if (singleQtyGroup) singleQtyGroup.style.display = 'block';
                    if (multiQtyGroup) multiQtyGroup.style.display = 'none';

                    if (yoloStatusBox) {
                        yoloStatusBox.innerHTML = `
                            <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px 16px; color: #991b1b; font-size: 13px; display: flex; align-items: center; gap: 12px;">
                                <div style="width: 32px; height: 32px; border-radius: 50%; background: #ef4444; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
                                    <i class="fa-solid fa-triangle-exclamation"></i>
                                </div>
                                <div>
                                    <strong style="display:block; font-size: 13.5px; color: #991b1b;">No Food Detected in Uploaded Image</strong>
                                    <span style="font-size:12px; color:#b91c1c; opacity:0.9;">The YOLO model could not identify food in this photo. Please upload a clear photo of food (e.g. Dosa, Idli, Vada, Chutney).</span>
                                </div>
                            </div>
                        `;
                    }
                    return;
                }

                // Food WAS detected!
                window.currentDetectedFoodItems = result.food_items;
                const singleQtyGroup = document.getElementById('single-item-quantity-group');
                const multiQtyGroup = document.getElementById('multi-item-quantities-group');
                const multiList = document.getElementById('multi-item-quantities-list');

                if (result.multiple_items && result.food_items.length > 1) {
                    // MULTIPLE FOOD ITEMS DETECTED: accurately configure separate items
                    const summaryTitle = result.food_items.map(fi => fi.name).join(' & ');
                    if (foodNameInput) foodNameInput.value = summaryTitle;

                    if (singleQtyGroup) singleQtyGroup.style.display = 'none';
                    if (multiQtyGroup) multiQtyGroup.style.display = 'block';

                    if (multiList) {
                        multiList.innerHTML = result.food_items.map((fi) => {
                            const confPct = Math.round((fi.confidence || 0.9) * 100);
                            return `
                                <div style="background:#ffffff; border:1px solid #86efac; border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:8px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <strong style="font-size:13.5px; color:#14532d; display:flex; align-items:center; gap:6px;">
                                            <i class="fa-solid fa-utensils" style="color:#16a34a;"></i> ${fi.name}
                                        </strong>
                                        <span style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px;">${confPct}% match</span>
                                    </div>
                                    <div style="display:flex; gap:8px;">
                                        <input type="number" class="form-control multi-item-qty-input" data-food-name="${fi.name}" value="${fi.count || 5}" min="1" placeholder="Quantity" style="flex:2;" oninput="if(this.value < 1 && this.value !== '') this.value = 1;">
                                        <select class="form-control multi-item-unit-select" data-food-name="${fi.name}" style="flex:1;">
                                            <option value="plates" ${fi.default_unit === 'plates' ? 'selected' : ''}>plates</option>
                                            <option value="pieces" ${fi.default_unit === 'pieces' ? 'selected' : ''}>pieces</option>
                                            <option value="servings" ${fi.default_unit === 'servings' ? 'selected' : ''}>servings</option>
                                            <option value="kg" ${fi.default_unit === 'kg' ? 'selected' : ''}>kg</option>
                                        </select>
                                    </div>
                                </div>
                            `;
                        }).join('');
                    }

                    if (yoloStatusBox) {
                        yoloStatusBox.innerHTML = `
                            <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px 16px; color: #166534; font-size: 13px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px;">
                                        <i class="fa-solid fa-layer-group"></i>
                                    </div>
                                    <div>
                                        <div style="font-size: 14px; font-weight: 700; color: #14532d;">
                                            ${result.food_items.length} Distinct Food Items Detected: ${summaryTitle}
                                        </div>
                                        <div style="font-size: 11px; color: #15803d; margin-top: 2px;">
                                            <i class="fa-solid fa-microchip"></i> Identified by YOLO model • Each item will be added separately
                                        </div>
                                    </div>
                                </div>
                                <span class="badge" style="background:#16a34a; color:#fff; font-size:11px; padding:4px 10px; border-radius:12px;">
                                    <i class="fa-solid fa-robot"></i> Multi-Item YOLO
                                </span>
                            </div>
                        `;
                    }
                } else {
                    // SINGLE FOOD ITEM DETECTED
                    const singleItem = result.food_items[0];
                    if (foodNameInput) foodNameInput.value = singleItem.name;

                    if (singleQtyGroup) singleQtyGroup.style.display = 'block';
                    if (multiQtyGroup) multiQtyGroup.style.display = 'none';

                    const qtyEl = document.getElementById('add-item-qty');
                    const unitEl = document.getElementById('add-item-unit');
                    if (qtyEl) qtyEl.value = singleItem.count || 5;
                    if (unitEl && singleItem.default_unit) unitEl.value = singleItem.default_unit;

                    const confPercent = Math.round((singleItem.confidence || 0.9) * 100);
                    const confBadge = `<span style="background:#dcfce7; color:#166534; font-weight:700; font-size:11px; padding:3px 8px; border-radius:12px; margin-left:6px;">${confPercent}% match</span>`;

                    if (yoloStatusBox) {
                        yoloStatusBox.innerHTML = `
                            <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px 16px; color: #166534; font-size: 13px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <div style="width: 32px; height: 32px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 15px;">
                                        <i class="fa-solid fa-check"></i>
                                    </div>
                                    <div>
                                        <div style="font-size: 14px; font-weight: 700; color: #14532d;">
                                            Identified Food: ${singleItem.name} ${confBadge}
                                        </div>
                                        <div style="font-size: 11px; color: #15803d; margin-top: 2px;">
                                            <i class="fa-solid fa-microchip"></i> Detected by YOLO food model
                                        </div>
                                    </div>
                                </div>
                                <span class="badge" style="background:#16a34a; color:#fff; font-size:11px; padding:4px 10px; border-radius:12px;">
                                    <i class="fa-solid fa-robot"></i> YOLO AI
                                </span>
                            </div>
                        `;
                    }
                }
            } catch (err) {
                console.error("YOLO detection error:", err);
                window.currentDetectedFoodItems = [];
                if (foodNameInput) foodNameInput.value = '';
                if (yoloStatusBox) {
                    yoloStatusBox.innerHTML = `
                        <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 12px 16px; color: #991b1b; font-size: 13px; display: flex; align-items: center; gap: 10px;">
                            <i class="fa-solid fa-triangle-exclamation" style="font-size:18px; color:#ef4444;"></i>
                            <div>
                                <strong>Food Detection Notice</strong>
                                <div style="font-size: 11px;">Could not classify food in this image. Please upload a clear photo of food.</div>
                            </div>
                        </div>
                    `;
                }
            }
        });
    }

    // Global form reset function to ensure all fields are completely blank for next item
    window.resetAddFoodItemForm = function() {
        const nameEl = document.getElementById('add-item-name');
        const prepEl = document.getElementById('add-item-prep');
        const qtyEl = document.getElementById('add-item-qty');
        const unitEl = document.getElementById('add-item-unit');
        const storageEl = document.getElementById('add-item-storage');
        const photoInput = document.getElementById('add-item-photo');
        const photoContainer = document.getElementById('photo-upload-container');
        const photoText = document.getElementById('photo-upload-text');
        const photoOptional = document.getElementById('photo-upload-optional');
        const yoloStatusBox = document.getElementById('yolo-detection-status');
        const singleQtyGroup = document.getElementById('single-item-quantity-group');
        const multiQtyGroup = document.getElementById('multi-item-quantities-group');
        const multiList = document.getElementById('multi-item-quantities-list');

        if (nameEl) nameEl.value = '';
        if (prepEl) prepEl.value = '';
        if (qtyEl) qtyEl.value = '';
        if (unitEl) unitEl.selectedIndex = 0;
        if (storageEl) storageEl.selectedIndex = 0;
        if (photoInput) photoInput.value = '';
        currentUploadedPhotoDataUrl = null;
        window.currentDetectedFoodItems = [];

        if (singleQtyGroup) singleQtyGroup.style.display = 'block';
        if (multiQtyGroup) multiQtyGroup.style.display = 'none';
        if (multiList) multiList.innerHTML = '';

        if (photoContainer) {
            photoContainer.style.backgroundImage = 'none';
            photoContainer.style.backgroundColor = '#f8fafc';
        }
        if (photoText) {
            photoText.innerText = 'Click to Upload Food Photo';
            photoText.style.color = '#0f172a';
            photoText.style.textShadow = 'none';
        }
        if (photoOptional) {
            photoOptional.innerText = 'YOLO AI model will automatically detect the food item';
            photoOptional.style.color = '#64748b';
        }
        if (yoloStatusBox) {
            yoloStatusBox.style.display = 'none';
            yoloStatusBox.innerHTML = '';
        }
    };

    // Add Food Item Click Handler (Validates Photo, Cooked Time, Quantity & evaluates Shelf Life with Ollama)
    const btnAddItem = document.getElementById('btn-add-food-item');
    if (btnAddItem) {
        btnAddItem.addEventListener('click', async (e) => {
            const nameEl = document.getElementById('add-item-name');
            const prepEl = document.getElementById('add-item-prep');
            const qtyEl = document.getElementById('add-item-qty');
            const unitEl = document.getElementById('add-item-unit');
            const storageEl = document.getElementById('add-item-storage');

            // 1. Photo validation
            if (!currentUploadedPhotoDataUrl && (!photoInput || !photoInput.files || !photoInput.files[0])) {
                alert('Please upload a food photo so the YOLO AI model can identify it.');
                return;
            }

            // Food item detection validation: require valid detected food
            if (!window.currentDetectedFoodItems || window.currentDetectedFoodItems.length === 0) {
                if (!nameEl || !nameEl.value.trim()) {
                    alert('No food items were detected in the uploaded photo. Please upload a clear photo showing food (e.g. Dosa, Idli, Vada, Chutney).');
                    return;
                }
            }

            // 2. Cooked time validation
            if (!prepEl || !prepEl.value) {
                alert('Please select the Cooked Time (when the food was prepared).');
                if (prepEl) prepEl.focus();
                return;
            }

            const prep = prepEl.value;
            const storage = storageEl ? storageEl.value : 'Room Temperature';

            // 3. Determine items to add (single vs multiple detected items)
            let itemsToProcess = [];
            if (window.currentDetectedFoodItems && window.currentDetectedFoodItems.length > 1) {
                // MULTIPLE DETECTED ITEMS: process and add each item individually!
                for (const det of window.currentDetectedFoodItems) {
                    const qInput = document.querySelector(`.multi-item-qty-input[data-food-name="${det.name}"]`);
                    const uSelect = document.querySelector(`.multi-item-unit-select[data-food-name="${det.name}"]`);
                    const qVal = qInput ? Number(qInput.value) : (det.count || 1);
                    const uVal = uSelect ? uSelect.value : (det.default_unit || 'plates');
                    itemsToProcess.push({
                        name: det.name,
                        quantity: Math.max(1, qVal),
                        unit: uVal
                    });
                }
            } else {
                // SINGLE DETECTED ITEM
                const qty = qtyEl ? Number(qtyEl.value) : 1;
                if (!qtyEl || !qtyEl.value || isNaN(qty) || qty < 1) {
                    alert('Please enter a valid Quantity (at least 1).');
                    if (qtyEl) qtyEl.focus();
                    return;
                }
                const unit = unitEl ? unitEl.value : 'plates';
                const name = (window.currentDetectedFoodItems && window.currentDetectedFoodItems[0]?.name) || (nameEl && nameEl.value.trim()) || 'Food Item';
                itemsToProcess.push({
                    name: name,
                    quantity: qty,
                    unit: unit
                });
            }

            // Show feedback during edibility analysis
            const origBtnText = btnAddItem.innerHTML;
            btnAddItem.disabled = true;
            btnAddItem.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking Shelf Life (Ollama AI)...';

            // Helper to evaluate shelf-life for each individual item
            async function evaluateItemEdibility(itemName) {
                let edibilityData = null;
                try {
                    const endpoints = [
                        (typeof API_BASE !== 'undefined' ? `${API_BASE}/ai/analyze-shelf-life` : 'http://127.0.0.1:5000/api/ai/analyze-shelf-life'),
                        'http://127.0.0.1:5000/api/ai/analyze-shelf-life',
                        'http://localhost:5000/api/ai/analyze-shelf-life',
                        '/api/ai/analyze-shelf-life'
                    ];

                    for (const ep of endpoints) {
                        try {
                            const res = await fetch(ep, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    food_name: itemName,
                                    prep_time: prep,
                                    storage_condition: storage
                                })
                            });
                            if (res.ok) {
                                edibilityData = await res.json();
                                if (edibilityData && edibilityData.success) break;
                            }
                        } catch (e) {}
                    }
                } catch (err) {
                    console.error("Shelf life evaluation error:", err);
                }

                if (!edibilityData || !edibilityData.success) {
                    const now = new Date();
                    const prepDate = new Date(prep);
                    const diffHours = Math.max(0, (now - prepDate) / (1000 * 60 * 60));
                    let baseShelf = 5.0;
                    if (storage.toLowerCase().includes('refrigerat')) baseShelf = 30.0;
                    else if (storage.toLowerCase().includes('frozen')) baseShelf = 120.0;
                    const isEdible = diffHours <= baseShelf;
                    edibilityData = {
                        is_edible: isEdible,
                        status: isEdible ? "Edible" : "Not Edible",
                        hours_elapsed: Math.round(diffHours * 10) / 10,
                        shelf_life_hours: baseShelf,
                        remaining_hours: Math.round((baseShelf - diffHours) * 10) / 10,
                        reason: isEdible ? `Safe for consumption within ${baseShelf}h safe shelf life window.` : `Exceeded safe shelf life limit of ${baseShelf}h.`
                    };
                }
                return edibilityData;
            }

            // 4. Create and push each food item separately into currentDonationItems
            for (const it of itemsToProcess) {
                const edibility = await evaluateItemEdibility(it.name);
                const newItem = {
                    name: it.name,
                    category: 'Cooked Food',
                    quantity: it.quantity,
                    unit: it.unit,
                    prepDate: prep,
                    storageCondition: storage,
                    edibility: edibility,
                    photo: currentUploadedPhotoDataUrl || null,
                    packages: 1
                };
                currentDonationItems.push(newItem);
            }

            btnAddItem.disabled = false;
            btnAddItem.innerHTML = origBtnText;

            renderFoodItems();
            saveDraft();

            // Clear all fields for the next item so user starts fresh
            window.resetAddFoodItemForm();

            // Collapse form and show "Add Another Food Item" button
            const formContainer = document.getElementById('add-item-form-container');
            const showBtn = document.getElementById('btn-show-add-form');
            if (formContainer && showBtn) {
                formContainer.style.display = 'none';
                showBtn.style.display = 'flex';
            }
        });
    }
});

// Remove Food Item
window.removeFoodItem = function(index) {
    if (typeof currentDonationItems !== 'undefined' && currentDonationItems[index]) {
        currentDonationItems.splice(index, 1);
        renderFoodItems();
        if (typeof saveDraft === 'function') saveDraft();
    }
};

function renderFoodItems() {
    const mainList = document.getElementById('dynamic-food-list');
    const addedHeader = document.getElementById('added-items-header');
    const formContainer = document.getElementById('add-item-form-container');
    const showBtn = document.getElementById('btn-show-add-form');

    if (addedHeader) {
        if (currentDonationItems.length > 0) {
            addedHeader.style.display = 'block';
            addedHeader.textContent = `Added Food Items (${currentDonationItems.length})`;
        } else {
            addedHeader.style.display = 'none';
            if (formContainer) formContainer.style.display = 'block';
            if (showBtn) showBtn.style.display = 'none';
        }
    }

    if (mainList) {
        mainList.innerHTML = '';
        currentDonationItems.forEach((item, index) => {
            let prepFormatted = item.prepDate ? new Date(item.prepDate).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Not specified';

            let iconOrImage = item.photo 
                ? `<img src="${item.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;" alt="${item.name}">`
                : `<i class="fa-solid fa-bowl-food" style="font-size:22px; color:var(--dash-primary);"></i>`;

            mainList.innerHTML += `
                <div class="food-item-row" style="display:flex; gap:16px; align-items:center; background:#fff; border:1px solid var(--dash-border); border-radius:12px; padding:16px; margin-bottom:12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <div style="width:68px; height:68px; border-radius:10px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0; border:1px solid #e2e8f0;">
                        ${iconOrImage}
                    </div>
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
                            <h4 style="margin:0; font-size:16px; font-weight:700; color:#0f172a;">${item.name}</h4>
                            <span style="background:#e0e7ff; color:#3730a3; font-size:11px; font-weight:700; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
                                <i class="fa-solid fa-robot"></i> YOLO AI
                            </span>
                            ${item.edibility ? `
                                <span style="background:${item.edibility.is_edible ? '#dcfce7' : '#fee2e2'}; color:${item.edibility.is_edible ? '#15803d' : '#b91c1c'}; font-size:11px; font-weight:700; padding:2px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px;">
                                    <i class="fa-solid ${item.edibility.is_edible ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
                                    ${item.edibility.is_edible ? (item.edibility.remaining_hours !== undefined ? `Edible (~${item.edibility.remaining_hours}h left)` : 'Edible') : 'Not Edible'}
                                </span>
                            ` : ''}
                        </div>
                        <div style="display:flex; gap:16px; font-size:13px; color:#475569; flex-wrap:wrap;">
                            <div><strong style="color:#0f172a;">Quantity:</strong> ${item.quantity} ${item.unit}</div>
                            <div><strong style="color:#0f172a;">Cooked Time:</strong> ${prepFormatted}</div>
                            ${item.storageCondition ? `<div><strong style="color:#0f172a;">Storage:</strong> ${item.storageCondition}</div>` : ''}
                        </div>
                        ${item.edibility && item.edibility.reason ? `
                            <div style="margin-top:8px; font-size:12px; line-height:1.4; color:#334155; background:#f8fafc; padding:8px 12px; border-radius:8px; border-left:3px solid ${item.edibility.is_edible ? '#16a34a' : '#ef4444'};">
                                <span style="font-weight:600; color:${item.edibility.is_edible ? '#15803d' : '#b91c1c'};"><i class="fa-solid fa-microchip"></i> Ollama AI:</span> ${item.edibility.reason}
                            </div>
                        ` : ''}
                    </div>
                    <button type="button" class="btn" onclick="removeFoodItem(${index})" title="Remove item" style="background:#fee2e2; color:#ef4444; border:none; width:36px; height:36px; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0; transition:all 0.2s ease;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;
        });
    }

    // Update summary list
    const summaryList = document.querySelector('.compact-summary-list');
    if (summaryList) {
        summaryList.innerHTML = '';
        let totalWeight = 0;
        
        currentDonationItems.forEach(item => {
            totalWeight += Number(item.quantity || 0);
            
            const edibleTag = item.edibility 
                ? (item.edibility.is_edible 
                    ? ` • <span style="color:#15803d; font-weight:700;">Edible</span>` 
                    : ` • <span style="color:#b91c1c; font-weight:700;">Not Edible</span>`)
                : '';

            summaryList.innerHTML += `
                <div style="display:flex; gap:12px; align-items:center; margin-bottom:8px;">
                    <div style="width:36px; height:36px; border-radius:6px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; font-size:12px; overflow:hidden; flex-shrink:0; border:1px solid #e2e8f0;">
                        ${item.photo ? `<img src="${item.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;" alt="${item.name}">` : `<i class="fa-solid fa-bowl-food" style="color:var(--dash-primary);"></i>`}
                    </div>
                    <div style="flex:1; min-width:0;">
                        <h5 style="margin:0; font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</h5>
                        <p style="margin:0; font-size:11px; color:var(--dash-text-muted);">${item.quantity} ${item.unit}${item.storageCondition ? ` • ${item.storageCondition}` : ''}${edibleTag}</p>
                    </div>
                </div>
            `;
        });
        
        // Update summary totals
        const weightEl = document.getElementById('summary-total-weight');
        const pkgEl = document.getElementById('summary-total-packages');
        const countEl = document.getElementById('summary-item-count');
        
        if (weightEl) weightEl.textContent = `${totalWeight} items`; 
        if (pkgEl) pkgEl.textContent = `${currentDonationItems.length}`;
        if (countEl) countEl.textContent = `${currentDonationItems.length} Items`;
    }

    if (typeof updateReviewStep === 'function') {
        updateReviewStep();
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
let lastAiSummaryHash = '';
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

    // Fetch Ollama AI Donation Summary if Step 4 is reached or visible
    if (typeof window.fetchDonationAiSummary === 'function') {
        window.fetchDonationAiSummary();
    }
};

window.fetchDonationAiSummary = async function() {
    const summaryCard = document.getElementById('review-ai-summary-card');
    const badgeEl = document.getElementById('review-ai-status-badge');
    const textEl = document.getElementById('review-ai-summary-text');
    const adviceEl = document.getElementById('review-ai-handling-advice');

    if (!summaryCard || !textEl) return;

    const items = (typeof currentDonationItems !== 'undefined' && currentDonationItems) ? currentDonationItems : [];

    if (items.length === 0) {
        textEl.textContent = "No food items added yet. Please add food items in Step 1.";
        if (adviceEl) adviceEl.textContent = "Shelf life and handling advice will appear once food items are added.";
        if (badgeEl) {
            badgeEl.className = 'badge';
            badgeEl.style.background = '#f1f5f9';
            badgeEl.style.color = '#64748b';
            badgeEl.innerHTML = '<i class="fa-solid fa-circle-info"></i> No Items';
        }
        return;
    }

    // Hash check to avoid re-triggering Ollama if items haven't changed
    const currentHash = JSON.stringify(items.map(i => ({
        n: i.name,
        q: i.quantity,
        u: i.unit,
        p: i.prepDate,
        s: i.storageCondition,
        e: i.edibility ? i.edibility.is_edible : null
    })));

    if (currentHash === lastAiSummaryHash) return;

    // Show loading state
    textEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color:var(--dash-primary); margin-right:6px;"></i> Generating donation summary with Ollama AI...';
    if (adviceEl) adviceEl.textContent = "Analyzing safe consumption shelf life and storage conditions...";
    if (badgeEl) {
        badgeEl.style.background = '#fef3c7';
        badgeEl.style.color = '#b45309';
        badgeEl.innerHTML = '<i class="fa-solid fa-gear fa-spin"></i> Analyzing...';
    }

    const candidateUrls = [
        (typeof API_BASE !== 'undefined' && API_BASE) ? `${API_BASE}/ai/donation-summary` : null,
        'http://127.0.0.1:5000/api/ai/donation-summary',
        '/api/ai/donation-summary'
    ].filter(Boolean);

    let summaryData = null;
    for (const url of candidateUrls) {
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: items })
            });
            if (res.ok) {
                summaryData = await res.json();
                if (summaryData && summaryData.success) break;
            }
        } catch (e) {}
    }

    lastAiSummaryHash = currentHash;

    if (summaryData && summaryData.success) {
        textEl.textContent = summaryData.summary_text;
        if (adviceEl) adviceEl.textContent = summaryData.handling_advice || "Maintain safe temperature during transport and distribute promptly.";
        
        if (badgeEl) {
            if (summaryData.all_edible) {
                badgeEl.style.background = '#dcfce7';
                badgeEl.style.color = '#15803d';
                badgeEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${summaryData.summary_headline || 'All Items Edible'}`;
                summaryCard.style.borderLeftColor = '#16a34a';
            } else {
                badgeEl.style.background = '#fee2e2';
                badgeEl.style.color = '#b91c1c';
                badgeEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${summaryData.summary_headline || 'Quality Notice'}`;
                summaryCard.style.borderLeftColor = '#ef4444';
            }
        }
    } else {
        // Fallback
        const allEdible = items.every(i => !i.edibility || i.edibility.is_edible);
        textEl.textContent = allEdible
            ? `Donation contains ${items.length} item(s) prepared within safe shelf life guidelines. Ready for distribution.`
            : `Donation contains ${items.length} item(s); some items have exceeded safe shelf life. Please review item list.`;
        if (adviceEl) adviceEl.textContent = "Maintain appropriate food storage temperatures during pickup and transit.";
        if (badgeEl) {
            badgeEl.style.background = allEdible ? '#dcfce7' : '#fee2e2';
            badgeEl.style.color = allEdible ? '#15803d' : '#b91c1c';
            badgeEl.innerHTML = allEdible ? '<i class="fa-solid fa-circle-check"></i> Quality Verified' : '<i class="fa-solid fa-triangle-exclamation"></i> Quality Notice';
            summaryCard.style.borderLeftColor = allEdible ? '#16a34a' : '#ef4444';
        }
    }
};
