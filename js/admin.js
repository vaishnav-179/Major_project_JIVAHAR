// Jivahar Admin Command Center & User Management Controller
const AdminPanel = {
    API_BASE_URL: 'http://127.0.0.1:5000/api',
    activeTab: 'overview',
    currentRoleFilter: 'all',
    currentSearchQuery: '',
    currentUserModalId: null,

    init() {
        this.loadAdminProfile();
        this.initClock();
        this.loadPlatformStats();
        this.loadUsers();
        this.loadPendingNGOs();
        this.loadApprovedNGOs();
        this.loadAllDonations();
        this.loadSecurityLogs();

        // Real-time polling every 12 seconds
        setInterval(() => {
            this.loadPlatformStats(true);
            if (this.activeTab === 'users') {
                this.loadUsers(this.currentRoleFilter, this.currentSearchQuery, true);
            } else if (this.activeTab === 'donations') {
                this.loadAllDonations(true);
            } else if (this.activeTab === 'ngos') {
                this.loadPendingNGOs(true);
            }
        }, 12000);
    },

    initClock() {
        const clockEl = document.getElementById('admin-live-clock');
        if (!clockEl) return;
        const update = () => {
            const now = new Date();
            clockEl.textContent = now.toLocaleDateString('en-IN', {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            }) + ' • Live Master Node';
        };
        update();
        setInterval(update, 1000);
    },

    loadAdminProfile() {
        const nameEl = document.getElementById('admin-display-name');
        const avatarEl = document.getElementById('admin-avatar-initial');

        let name = "Platform Administrator";
        try {
            const userStr = localStorage.getItem('jivahar_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user && user.name) {
                    name = user.name;
                }
            }
        } catch (e) {
            console.error("Error reading admin user session:", e);
        }

        if (nameEl) nameEl.textContent = name;
        if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase() || 'A';
    },

    refreshAll() {
        this.loadPlatformStats();
        this.loadUsers(this.currentRoleFilter, this.currentSearchQuery);
        this.loadPendingNGOs();
        this.loadApprovedNGOs();
        this.loadAllDonations();
        this.loadSecurityLogs();
    },

    switchTab(tabId, clickedEl) {
        this.activeTab = tabId;

        // Update active sidebar item
        document.querySelectorAll('.sidebar-menu .menu-item').forEach(el => el.classList.remove('active'));
        if (clickedEl) {
            clickedEl.classList.add('active');
        } else {
            const matchingLink = document.querySelector(`.sidebar-menu .menu-item[data-tab="${tabId}"]`);
            if (matchingLink) matchingLink.classList.add('active');
        }

        // Hide all view panels
        document.querySelectorAll('.admin-view-panel').forEach(panel => {
            panel.style.display = 'none';
        });

        // Show target view panel
        let targetPanelId = 'admin-welcome-view';
        let pageTitle = 'Platform Real-Time Overview';

        if (tabId === 'overview') {
            targetPanelId = 'admin-welcome-view';
            pageTitle = 'Platform Real-Time Analytics';
            this.loadPlatformStats();
        } else if (tabId === 'users') {
            targetPanelId = 'user-management-view';
            pageTitle = 'Platform User Management & Access Control';
            this.loadUsers(this.currentRoleFilter, this.currentSearchQuery);
        } else if (tabId === 'donations') {
            targetPanelId = 'admin-donations-view';
            pageTitle = 'Platform Donations & Food Safety Oversight';
            this.loadAllDonations();
        } else if (tabId === 'ngos') {
            targetPanelId = 'ngo-approval-view';
            pageTitle = 'NGO Partner Applications & Verification';
            this.loadPendingNGOs();
            this.loadApprovedNGOs();
        } else if (tabId === 'security') {
            targetPanelId = 'admin-security-view';
            pageTitle = 'Security Logs & Administrative Audit Trail';
            this.loadSecurityLogs();
        }

        const targetPanel = document.getElementById(targetPanelId);
        if (targetPanel) {
            targetPanel.style.display = 'flex';
        }

        const titleEl = document.getElementById('topbar-page-title');
        if (titleEl) titleEl.textContent = pageTitle;
    },

    // 1. PLATFORM STATS & ANALYTICS
    async loadPlatformStats(isSilent = false) {
        try {
            const res = await fetch(`${this.API_BASE_URL}/admin/stats`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.success && data.stats) {
                const s = data.stats;

                // Update 4 Main KPI Cards
                this.updateText('admin-stat-total-users', Number(s.total_users || 0).toLocaleString());
                this.updateText('admin-stat-pending-ngos', Number(s.pending_ngos_count || 0).toLocaleString());
                this.updateText('admin-stat-active-donations', Number(s.active_donations || 0).toLocaleString());
                this.updateText('admin-stat-meals-saved', Number(s.meals_saved || 0).toLocaleString());

                // Update Topbar Notification Badge
                const badgeEl = document.querySelector('.notification-badge');
                if (badgeEl) {
                    const count = Number(s.pending_ngos_count || 0);
                    badgeEl.textContent = count > 9 ? '9+' : count;
                    badgeEl.style.display = count > 0 ? 'flex' : 'none';
                }

                // Update Role Breakdown Quick Counters
                this.updateText('breakdown-donors', Number(s.donors_count || 0).toLocaleString());
                this.updateText('breakdown-ngos', Number(s.ngos_count || 0).toLocaleString());
                this.updateText('breakdown-volunteers', Number(s.volunteers_count || 0).toLocaleString());
                this.updateText('breakdown-mfg', Number(s.manufacturers_count || 0).toLocaleString());
                this.updateText('breakdown-waste-kg', `${Number(s.total_waste_recycled_kg || 0).toLocaleString()} kg`);

                // Update Donation Lifecycle Progress Bars
                const totalDons = Math.max(1, Number(s.total_donations || 0));
                const activeDons = Number(s.active_donations || 0);
                const delivDons = Number(s.delivered_donations || 0);
                const recDons = Number(s.recycled_donations || 0);

                this.updateProgressBar('stat-bar-active', (activeDons / totalDons) * 100);
                this.updateText('stat-bar-active-count', `${activeDons} (${Math.round((activeDons/totalDons)*100)}%)`);

                this.updateProgressBar('stat-bar-delivered', (delivDons / totalDons) * 100);
                this.updateText('stat-bar-delivered-count', `${delivDons} (${Math.round((delivDons/totalDons)*100)}%)`);

                this.updateProgressBar('stat-bar-recycled', (recDons / totalDons) * 100);
                this.updateText('stat-bar-recycled-count', `${recDons} (${Math.round((recDons/totalDons)*100)}%)`);

                // Render Live Recent Activity Table
                this.renderRecentActivities(s.recent_activities || []);
            }
        } catch (err) {
            if (!isSilent) console.error('Error loading platform stats:', err);
        }
    },

    updateText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    },

    updateProgressBar(id, pct) {
        const el = document.getElementById(id);
        if (el) el.style.width = `${Math.min(100, Math.max(0, pct))}%`;
    },

    renderRecentActivities(activities) {
        const tbody = document.getElementById('admin-recent-activity-tbody');
        if (!tbody) return;

        if (!activities || activities.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" style="padding: 24px; text-align: center; color: var(--dash-text-muted);">
                        No system activity recorded yet.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = activities.map(act => {
            let timeStr = 'Recent';
            if (act.timestamp) {
                try {
                    const dt = new Date(act.timestamp);
                    timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
                } catch (e) {}
            }

            let badgeStyle = 'background:#dbeafe; color:#1d4ed8;';
            if (act.badge_class === 'green') badgeStyle = 'background:#dcfce7; color:#15803d;';
            else if (act.badge_class === 'purple') badgeStyle = 'background:#f3e8ff; color:#7e22ce;';
            else if (act.badge_class === 'orange') badgeStyle = 'background:#fef3c7; color:#b45309;';
            else if (act.badge_class === 'red') badgeStyle = 'background:#fee2e2; color:#b91c1c;';

            const iconClass = act.type === 'user_registration' ? 'fa-user-plus' : 'fa-box';

            return `
                <tr style="border-bottom: 1px solid var(--dash-border);">
                    <td style="padding: 12px 18px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:13px; ${badgeStyle}">
                                <i class="fa-solid ${iconClass}"></i>
                            </div>
                            <div>
                                <strong style="color:var(--dash-text-main); font-size:13px; display:block;">${act.title}</strong>
                                <span style="color:var(--dash-text-muted); font-size:11.5px;">${act.description}</span>
                            </div>
                        </div>
                    </td>
                    <td style="padding: 12px 18px;">
                        <span style="font-size:11px; font-weight:700; padding:3px 8px; border-radius:12px; ${badgeStyle}">
                            ${act.status}
                        </span>
                    </td>
                    <td style="padding: 12px 18px; text-align:right; color:var(--dash-text-muted); font-size:11.5px;">
                        ${timeStr}
                    </td>
                </tr>
            `;
        }).join('');
    },

    // 2. USER MANAGEMENT
    handleUserSearch(query) {
        this.currentSearchQuery = (query || '').trim();
        this.loadUsers(this.currentRoleFilter, this.currentSearchQuery);
    },

    filterUsersByRole(role, btnEl) {
        this.currentRoleFilter = role;
        const container = document.getElementById('user-role-filter-pills');
        if (container) {
            container.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
        }
        if (btnEl) btnEl.classList.add('active');

        this.loadUsers(role, this.currentSearchQuery);
    },

    async loadUsers(role = 'all', search = '', isSilent = false) {
        const tbody = document.getElementById('admin-users-table-tbody');
        if (!isSilent && tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--dash-text-muted);"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i> Loading platform users...</td></tr>';
        }

        try {
            const res = await fetch(`${this.API_BASE_URL}/admin/users?role=${role}&search=${encodeURIComponent(search)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.success && Array.isArray(data.users)) {
                this.renderUsersTable(data.users);
            }
        } catch (err) {
            if (!isSilent) {
                console.error('Error fetching users:', err);
                if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#ef4444;">Failed to load users: ${err.message}</td></tr>`;
            }
        }
    },

    renderUsersTable(users) {
        const tbody = document.getElementById('admin-users-table-tbody');
        if (!tbody) return;

        if (!users || users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align:center; padding:40px 20px; color:var(--dash-text-muted);">
                        <i class="fa-solid fa-user-slash" style="font-size:28px; color:#cbd5e1; margin-bottom:8px; display:block;"></i>
                        No users match the selected role or search criteria.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = users.map(u => {
            const role = (u.role || 'user').toLowerCase();
            let roleClass = 'role-badge-donor';
            if (role === 'ngo') roleClass = 'role-badge-ngo';
            else if (role === 'volunteer') roleClass = 'role-badge-volunteer';
            else if (role === 'manufacturer') roleClass = 'role-badge-manufacturer';
            else if (role === 'admin') roleClass = 'role-badge-admin';

            const initial = (u.name || 'U').charAt(0).toUpperCase();
            const isAdmin = role === 'admin' || u.email === 'admin@jivahar.com';

            const statusBadge = u.approved
                ? `<span style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; border:1px solid #bbf7d0;"><i class="fa-solid fa-circle-check" style="font-size:9px; margin-right:3px;"></i>Active</span>`
                : `<span style="background:#fef3c7; color:#b45309; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; border:1px solid #fde68a;"><i class="fa-solid fa-clock" style="font-size:9px; margin-right:3px;"></i>Pending Review</span>`;

            return `
                <tr style="border-bottom:1px solid var(--dash-border); transition:background 0.15s;">
                    <td style="padding:14px 18px;">
                        <div style="display:flex; align-items:center; gap:12px;">
                            <div style="width:38px; height:38px; border-radius:50%; background:#f1f5f9; color:#0f172a; font-weight:800; font-size:15px; display:flex; align-items:center; justify-content:center; border:1.5px solid var(--dash-border);">
                                ${initial}
                            </div>
                            <div>
                                <strong style="font-size:13.5px; color:#0f172a; display:block;">${u.name}</strong>
                                <span style="font-size:11px; color:#64748b;">Joined ${u.created_at}</span>
                            </div>
                        </div>
                    </td>
                    <td style="padding:14px 18px;">
                        <span class="role-badge ${roleClass}">${u.role}</span>
                    </td>
                    <td style="padding:14px 18px;">
                        <div style="font-size:13px; color:#0f172a; font-weight:600;">${u.email}</div>
                        <div style="font-size:11.5px; color:#64748b;"><i class="fa-solid fa-phone" style="font-size:10px; margin-right:4px;"></i>${u.phone}</div>
                    </td>
                    <td style="padding:14px 18px; max-width:200px;">
                        <div style="font-size:12px; color:#475569; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${u.address || 'Local Region'}">
                            <i class="fa-solid fa-location-dot" style="color:#ef4444; font-size:11px; margin-right:4px;"></i>${u.address || 'Local Region'}
                        </div>
                    </td>
                    <td style="padding:14px 18px;">
                        <div style="font-size:12.5px; font-weight:700; color:#0f172a;">${u.activity_metric}</div>
                        <div style="margin-top:2px;">${statusBadge}</div>
                    </td>
                    <td style="padding:14px 18px; text-align:right;">
                        <div style="display:inline-flex; gap:8px;">
                            <button class="btn-view-user" onclick="AdminPanel.viewUserDetails('${u._id}')" title="Inspect complete individual profile and activity dossier">
                                <i class="fa-solid fa-id-card"></i> Dossier
                            </button>
                            ${!isAdmin ? `
                                <button class="btn-remove-user" onclick="AdminPanel.confirmRemoveUser('${u._id}', '${u.name.replace(/'/g, "\\'")}', '${u.email}', '${u.role}')" title="Remove suspicious user from platform">
                                    <i class="fa-solid fa-trash-can"></i> Remove
                                </button>
                            ` : `
                                <button class="btn-remove-user" style="opacity:0.4; cursor:not-allowed;" disabled title="Root Administrator accounts cannot be deleted">
                                    <i class="fa-solid fa-shield-halved"></i> Protected
                                </button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // 3. INDIVIDUAL USER DETAILS MODAL
    async viewUserDetails(userId) {
        const modal = document.getElementById('modal-user-details');
        if (!modal) return;

        this.currentUserModalId = userId;
        modal.style.display = 'flex';

        // Set Loading State
        document.getElementById('modal-user-name').textContent = 'Loading user dossier...';
        document.getElementById('modal-user-email-phone').textContent = 'Retrieving real-time records from database...';
        document.getElementById('modal-user-kpis-grid').innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:16px; color:#64748b;"><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px;"></i> Fetching data...</div>';
        document.getElementById('modal-user-activity-tbody').innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">Loading activity history...</td></tr>';

        try {
            const res = await fetch(`${this.API_BASE_URL}/admin/users/${userId}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.success && data.user) {
                this.renderIndividualUserModal(data.user, data.kpis || {}, data.activity_records || []);
            }
        } catch (err) {
            alert('Failed to retrieve individual user data: ' + err.message);
            this.closeUserModal();
        }
    },

    renderIndividualUserModal(user, kpis, records) {
        const initial = (user.name || 'U').charAt(0).toUpperCase();
        const role = (user.role || 'user').toLowerCase();

        // Basic Profile
        document.getElementById('modal-user-avatar').textContent = initial;
        document.getElementById('modal-user-name').textContent = user.name;
        document.getElementById('modal-user-email-phone').textContent = `${user.email} • ${user.phone || 'No phone'}`;
        document.getElementById('modal-user-address').textContent = user.address || 'Local Region';
        document.getElementById('modal-user-joined').textContent = user.created_at || 'Registered User';
        document.getElementById('modal-user-status').textContent = user.approved ? 'Active & Verified' : 'Pending Verification';

        // Role Badge
        const badge = document.getElementById('modal-user-role-badge');
        if (badge) {
            badge.className = `role-badge role-badge-${role}`;
            badge.textContent = user.role.toUpperCase();
        }

        // Render KPI Chips based on role
        const kpiGrid = document.getElementById('modal-user-kpis-grid');
        if (kpiGrid) {
            let chipsHTML = '';
            for (const [key, val] of Object.entries(kpis)) {
                const label = key.replace(/_/g, ' ');
                chipsHTML += `
                    <div class="kpi-chip">
                        <span>${label}</span>
                        <strong>${val}</strong>
                    </div>
                `;
            }
            kpiGrid.innerHTML = chipsHTML || '<p style="color:#94a3b8; font-size:12px;">No KPI records.</p>';
        }

        // Render Activity Records Table
        const tbody = document.getElementById('modal-user-activity-tbody');
        const countBadge = document.getElementById('modal-activity-count-badge');
        if (countBadge) countBadge.textContent = `${records.length} Record(s)`;

        if (tbody) {
            if (records.length === 0) {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:#94a3b8;">No logged transactions or events on file for this user.</td></tr>`;
            } else {
                tbody.innerHTML = records.map(r => {
                    let title = r.source || `Consignment #${(r._id || '').slice(-6).toUpperCase()}`;
                    let details = 'Food Item';
                    let qty = '-';
                    let safety = 'Standard';
                    let status = r.status || 'Active';
                    let dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Recent';

                    if (role === 'donor') {
                        const items = r.items || [];
                        details = items.map(it => it.name).join(', ') || 'Surplus Food';
                        qty = items.map(it => `${it.quantity} ${it.unit || 'plates'}`).join(', ');
                        const hasInedible = items.some(it => it.edibility && it.edibility.is_edible === false);
                        safety = hasInedible 
                            ? `<span style="color:#b91c1c; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> Flagged Inedible</span>` 
                            : `<span style="color:#15803d; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Fresh & Edible</span>`;
                    } else if (role === 'ngo' || role === 'volunteer') {
                        details = (r.items || []).map(it => it.name).join(', ') || 'Food Consignment';
                        qty = `${(r.items || []).length} Item(s)`;
                        safety = `<span style="color:#15803d; font-weight:700;"><i class="fa-solid fa-check"></i> Safe</span>`;
                    } else if (role === 'manufacturer') {
                        details = r.waste_type || 'Organic Waste Consignment';
                        qty = `${r.quantity_kg || 0} kg`;
                        safety = `<span style="color:#7e22ce; font-weight:700;"><i class="fa-solid fa-recycle"></i> Bio-Feedstock</span>`;
                    }

                    return `
                        <tr style="border-bottom:1px solid var(--dash-border);">
                            <td style="padding:10px 14px;">
                                <strong style="color:#0f172a; display:block;">${title}</strong>
                                <span style="color:#64748b; font-size:11.5px;">${details}</span>
                            </td>
                            <td style="padding:10px 14px; font-weight:700; color:#0f172a;">${qty}</td>
                            <td style="padding:10px 14px;">${safety}</td>
                            <td style="padding:10px 14px;">
                                <span style="font-size:11px; font-weight:700; background:#f1f5f9; padding:2px 8px; border-radius:10px; color:#334155;">
                                    ${status}
                                </span>
                            </td>
                            <td style="padding:10px 14px; text-align:right; color:#64748b;">${dateStr}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Configure Danger Zone Remove Button
        const removeBtn = document.getElementById('modal-btn-remove-user');
        if (removeBtn) {
            if (role === 'admin' || user.email === 'admin@jivahar.com') {
                removeBtn.style.display = 'none';
            } else {
                removeBtn.style.display = 'inline-flex';
                removeBtn.onclick = () => {
                    this.confirmRemoveUser(user._id, user.name, user.email, user.role);
                };
            }
        }
    },

    closeUserModal() {
        const modal = document.getElementById('modal-user-details');
        if (modal) modal.style.display = 'none';
        this.currentUserModalId = null;
    },

    // 4. SUSPICIOUS USER REMOVAL
    async confirmRemoveUser(userId, userName, userEmail, userRole) {
        if (userRole === 'admin' || userEmail === 'admin@jivahar.com') {
            alert('❌ Security Restriction: Root Platform Administrator accounts cannot be deleted.');
            return;
        }

        const confirmText = `⚠️ ADMINISTRATIVE ACTION REQUIRED:\n\nAre you sure you want to PERMANENTLY REMOVE suspicious user '${userName}' (${userEmail})?\n\nRole: ${userRole.toUpperCase()}\n\n• User will be revoked and deleted from the database.\n• Any pending donations will be cancelled immediately.\n• This action is recorded in security audit logs.`;

        if (!confirm(confirmText)) return;

        try {
            const res = await fetch(`${this.API_BASE_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();

            if (res.ok && data.success) {
                alert(`✅ ${data.message}`);
                this.closeUserModal();
                this.loadUsers(this.currentRoleFilter, this.currentSearchQuery);
                this.loadPlatformStats();
                this.loadSecurityLogs();
            } else {
                alert(`❌ Failed to remove user: ${data.message || 'Unknown server error'}`);
            }
        } catch (err) {
            console.error('Error removing user:', err);
            alert(`❌ Network or server error: ${err.message}`);
        }
    },

    // 5. ALL DONATIONS
    async loadAllDonations(isSilent = false) {
        const tbody = document.getElementById('admin-donations-table-tbody');
        if (!isSilent && tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--dash-text-muted);"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px;"></i> Loading all donations...</td></tr>';
        }

        try {
            const res = await fetch(`${this.API_BASE_URL}/admin/donations`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.success && Array.isArray(data.donations)) {
                this.renderAllDonationsTable(data.donations);
            }
        } catch (err) {
            if (!isSilent) console.error('Error loading donations:', err);
        }
    },

    renderAllDonationsTable(donations) {
        const tbody = document.getElementById('admin-donations-table-tbody');
        if (!tbody) return;

        if (!donations || donations.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--dash-text-muted);">No donations found on platform.</td></tr>`;
            return;
        }

        tbody.innerHTML = donations.map(d => {
            const donId = (d._id || '').slice(-6).toUpperCase();
            const donorName = d.pickup_details?.contact_name || 'Donor';
            const donorPhone = d.pickup_details?.contact_phone || '-';
            const items = d.items || [];
            const itemsStr = items.map(it => `${it.name} (${it.quantity} ${it.unit || 'plates'})`).join(', ') || 'Food Consignment';
            const loc = d.pickup_location?.address || d.pickup_details?.address || 'Local Region';
            const status = d.status || 'Pending';
            
            let statusBadge = `<span style="background:#dbeafe; color:#1d4ed8; font-weight:700; font-size:11px; padding:3px 8px; border-radius:10px;">${status}</span>`;
            if (status === 'Delivered') {
                statusBadge = `<span style="background:#dcfce7; color:#15803d; font-weight:700; font-size:11px; padding:3px 8px; border-radius:10px;"><i class="fa-solid fa-circle-check"></i> Delivered</span>`;
            } else if (status.includes('Manufacturer') || status.includes('Recycled')) {
                statusBadge = `<span style="background:#f3e8ff; color:#7e22ce; font-weight:700; font-size:11px; padding:3px 8px; border-radius:10px;"><i class="fa-solid fa-recycle"></i> Recycled (Inedible)</span>`;
            } else if (status.includes('Cancelled')) {
                statusBadge = `<span style="background:#fee2e2; color:#b91c1c; font-weight:700; font-size:11px; padding:3px 8px; border-radius:10px;">Cancelled</span>`;
            }

            const hasInedible = items.some(it => it.edibility && it.edibility.is_edible === false);
            const edibilityPill = hasInedible 
                ? `<span style="font-size:10.5px; color:#b91c1c; font-weight:700; display:block;"><i class="fa-solid fa-triangle-exclamation"></i> Contains Inedible Scraps</span>` 
                : `<span style="font-size:10.5px; color:#15803d; font-weight:600; display:block;"><i class="fa-solid fa-circle-check"></i> Verified Fresh & Edible</span>`;

            let dateStr = 'Recent';
            if (d.created_at) {
                try {
                    dateStr = new Date(d.created_at).toLocaleDateString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
                } catch (e) {}
            }

            return `
                <tr style="border-bottom:1px solid var(--dash-border);">
                    <td style="padding:14px 18px; font-weight:800; color:#0f172a;">#${donId}</td>
                    <td style="padding:14px 18px;">
                        <strong style="font-size:13px; color:#0f172a; display:block;">${donorName}</strong>
                        <span style="font-size:11.5px; color:#64748b;">${donorPhone}</span>
                    </td>
                    <td style="padding:14px 18px;">
                        <div style="font-size:13px; font-weight:600; color:#1e293b;">${itemsStr}</div>
                        ${edibilityPill}
                    </td>
                    <td style="padding:14px 18px; max-width:200px; font-size:12px; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${loc}">
                        ${loc}
                    </td>
                    <td style="padding:14px 18px;">${statusBadge}</td>
                    <td style="padding:14px 18px; text-align:right; font-size:12px; color:#64748b;">${dateStr}</td>
                </tr>
            `;
        }).join('');
    },

    // 6. NGO APPROVALS & PARTNERS
    async loadPendingNGOs(isSilent = false) {
        const listBody = document.getElementById('pending-ngo-list');
        if (!isSilent && listBody) {
            listBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Loading pending NGOs...</td></tr>';
        }

        try {
            const res = await fetch(`${this.API_BASE_URL}/admin/ngos/pending`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.success && Array.isArray(data.ngos)) {
                this.renderPendingNGOList(data.ngos);
            }
        } catch (err) {
            if (!isSilent) console.error('Error loading pending NGOs:', err);
        }
    },

    renderPendingNGOList(ngos) {
        const listBody = document.getElementById('pending-ngo-list');
        if (!listBody) return;

        if (ngos.length === 0) {
            listBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--dash-text-muted);">✨ No pending NGOs waiting for verification. All applications are up to date!</td></tr>';
            return;
        }

        listBody.innerHTML = ngos.map(ngo => `
            <tr style="border-bottom: 1px solid var(--dash-border);">
                <td style="padding: 14px 18px; font-weight: 700; color: var(--dash-text-main);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:32px; height:32px; border-radius:8px; background:#fef3c7; color:#b45309; display:flex; align-items:center; justify-content:center;">
                            <i class="fa-solid fa-building-ngo"></i>
                        </div>
                        ${ngo.name}
                    </div>
                </td>
                <td style="padding: 14px 18px; color: var(--dash-text-muted);">${ngo.email}</td>
                <td style="padding: 14px 18px; color: var(--dash-text-muted);">${ngo.phone || 'N/A'}</td>
                <td style="padding: 14px 18px; text-align:right;">
                    <button class="btn-login-submit" style="padding: 7px 16px; width: auto; font-size: 12px; background: #15803d; border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: 700;" onclick="AdminPanel.approveNGO('${ngo._id}')">
                        <i class="fa-solid fa-check"></i> Approve NGO
                    </button>
                </td>
            </tr>
        `).join('');
    },

    async loadApprovedNGOs() {
        const listBody = document.getElementById('approved-ngo-list');
        if (!listBody) return;

        try {
            const res = await fetch(`${this.API_BASE_URL}/admin/users?role=ngo`);
            if (!res.ok) return;
            const data = await res.json();

            if (data.success && Array.isArray(data.users)) {
                const approved = data.users.filter(u => u.approved);
                if (approved.length === 0) {
                    listBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:#94a3b8;">No active approved NGOs yet.</td></tr>';
                    return;
                }

                listBody.innerHTML = approved.map(ngo => `
                    <tr style="border-bottom: 1px solid var(--dash-border);">
                        <td style="padding: 14px 18px; font-weight: 700; color: #0f172a;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div style="width:32px; height:32px; border-radius:8px; background:#dbeafe; color:#1d4ed8; display:flex; align-items:center; justify-content:center;">
                                    <i class="fa-solid fa-building-ngo"></i>
                                </div>
                                ${ngo.name}
                            </div>
                        </td>
                        <td style="padding: 14px 18px; color: #475569;">
                            <div>${ngo.email}</div>
                            <span style="font-size:11.5px; color:#64748b;">${ngo.phone}</span>
                        </td>
                        <td style="padding: 14px 18px; color: #64748b; font-size:12.5px;">
                            ${ngo.address || 'Karnataka Region'}
                        </td>
                        <td style="padding: 14px 18px;">
                            <span style="background:#dcfce7; color:#15803d; font-size:11px; font-weight:700; padding:3px 8px; border-radius:10px; border:1px solid #bbf7d0;">
                                <i class="fa-solid fa-circle-check"></i> Verified Partner
                            </span>
                        </td>
                        <td style="padding: 14px 18px; text-align:right;">
                            <button class="btn-view-user" onclick="AdminPanel.viewUserDetails('${ngo._id}')">
                                <i class="fa-solid fa-id-card"></i> View Dossier
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            console.error('Error loading approved NGOs:', err);
        }
    },

    async approveNGO(id) {
        if (!confirm('Are you sure you want to verify and activate this NGO partner account?')) return;

        try {
            const res = await fetch(`${this.API_BASE_URL}/admin/ngos/approve/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();

            if (res.ok && data.success) {
                alert('✅ NGO Approved successfully! Partner account is now active.');
                this.loadPendingNGOs();
                this.loadApprovedNGOs();
                this.loadPlatformStats();
                this.loadSecurityLogs();
            } else {
                alert(`❌ Approval Failed: ${data.message}`);
            }
        } catch (err) {
            console.error('Error approving NGO:', err);
            alert('❌ Network error occurred while approving NGO.');
        }
    },

    // 7. SECURITY & AUDIT LOGS
    async loadSecurityLogs() {
        const tbody = document.getElementById('admin-security-logs-tbody');
        if (!tbody) return;

        try {
            const res = await fetch(`${this.API_BASE_URL}/admin/audit-logs`);
            if (!res.ok) return;
            const data = await res.json();

            if (data.success && Array.isArray(data.logs)) {
                if (data.logs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:32px; color:#94a3b8;">No security incidents or administrative actions recorded yet. All operations nominal.</td></tr>';
                    return;
                }

                tbody.innerHTML = data.logs.map(log => {
                    let badge = '<span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:8px; font-weight:700; font-size:11px;">REMOVAL</span>';
                    if (log.action === 'NGO_APPROVAL') {
                        badge = '<span style="background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:8px; font-weight:700; font-size:11px;">VERIFICATION</span>';
                    }

                    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleString([], { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : 'Recent';

                    return `
                        <tr style="border-bottom:1px solid var(--dash-border);">
                            <td style="padding:14px 18px;">${badge}</td>
                            <td style="padding:14px 18px; font-weight:700; color:#0f172a;">${log.target_name} (${log.target_email})</td>
                            <td style="padding:14px 18px; text-transform:uppercase; font-size:12px; color:#64748b;">${log.target_role}</td>
                            <td style="padding:14px 18px; font-size:12.5px; color:#475569;">${log.reason || 'Verified by Platform Administrator'}</td>
                            <td style="padding:14px 18px; text-align:right; font-size:12px; color:#64748b;">${timeStr}</td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (err) {
            console.error('Error loading security logs:', err);
        }
    }
};

// Initialize Admin Panel on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    AdminPanel.init();
});

// ==============================================================================
// 8. OLLAMA LOCAL LLM ADMIN ASSISTANT CHATBOT MODULE
// ==============================================================================
const AdminChatbot = {
    isOpen: false,
    isThinking: false,

    toggle() {
        const win = document.getElementById('admin-chatbot-window');
        if (!win) return;
        this.isOpen = !this.isOpen;
        win.style.display = this.isOpen ? 'flex' : 'none';
        if (this.isOpen) {
            const input = document.getElementById('chatbot-input');
            if (input) setTimeout(() => input.focus(), 150);
            this.scrollToBottom();
        }
    },

    clearChat() {
        const container = document.getElementById('chatbot-messages');
        if (!container) return;
        container.innerHTML = `
            <div class="chat-msg bot-msg">
                <div class="chat-bubble">
                    <p>Hello Administrator! 👋 Conversation reset. I am your <strong>Jivahar Admin Assistant</strong> powered by local <strong>Ollama LLM</strong>.</p>
                    <p>Ask me anything about platform statistics, users, donation lifecycles, or food recycling metrics!</p>
                </div>
                <span class="chat-time">Just now</span>
            </div>
        `;
    },

    askSuggestion(text) {
        const input = document.getElementById('chatbot-input');
        if (!input) return;
        input.value = text;
        this.sendMessage();
    },

    scrollToBottom() {
        const container = document.getElementById('chatbot-messages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    },

    showTyping(show) {
        this.isThinking = show;
        const typingEl = document.getElementById('chatbot-typing');
        const sendBtn = document.getElementById('chatbot-send-btn');
        if (typingEl) typingEl.style.display = show ? 'flex' : 'none';
        if (sendBtn) sendBtn.disabled = show;
        if (show) this.scrollToBottom();
    },

    formatMarkdown(text) {
        if (!text) return '';
        // Escape HTML
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Bold **text**
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic *text*
        escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Lists: convert lines starting with "- " or "* " or "+ "
        const lines = escaped.split('\n');
        let inList = false;
        let htmlLines = [];

        for (let line of lines) {
            const trimmed = line.trim();
            if (/^[-*+]\s+/.test(trimmed)) {
                if (!inList) {
                    htmlLines.push('<ul>');
                    inList = true;
                }
                htmlLines.push(`<li>${trimmed.replace(/^[-*+]\s+/, '')}</li>`);
            } else {
                if (inList) {
                    htmlLines.push('</ul>');
                    inList = false;
                }
                if (trimmed.length > 0) {
                    htmlLines.push(`<p>${trimmed}</p>`);
                }
            }
        }
        if (inList) htmlLines.push('</ul>');

        return htmlLines.join('');
    },

    appendMessage(sender, text) {
        const container = document.getElementById('chatbot-messages');
        if (!container) return;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isUser = sender === 'user';
        const formatted = isUser 
            ? `<p>${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
            : this.formatMarkdown(text);

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${isUser ? 'user-msg' : 'bot-msg'}`;
        msgDiv.innerHTML = `
            <div class="chat-bubble">
                ${formatted}
            </div>
            <span class="chat-time">${timeStr}</span>
        `;
        container.appendChild(msgDiv);
        this.scrollToBottom();
    },

    async sendMessage(e) {
        if (e) e.preventDefault();
        if (this.isThinking) return;

        const input = document.getElementById('chatbot-input');
        if (!input) return;
        const query = input.value.trim();
        if (!query) return;

        // Append user question
        this.appendMessage('user', query);
        input.value = '';
        this.showTyping(true);

        try {
            const res = await fetch(`${AdminPanel.API_BASE_URL}/admin/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: query })
            });

            const data = await res.json();
            this.showTyping(false);

            if (res.ok && data.success && data.reply) {
                this.appendMessage('bot', data.reply);
            } else {
                const errMsg = data.message || 'Unable to retrieve answer from local Ollama model.';
                this.appendMessage('bot', `⚠️ **Error:** ${errMsg}`);
            }
        } catch (err) {
            console.error('Chatbot fetch error:', err);
            this.showTyping(false);
            this.appendMessage('bot', `⚠️ **Connection Error:** Could not contact the admin assistant service. Please verify server and Ollama status.`);
        }
    }
};

window.AdminChatbot = AdminChatbot;
