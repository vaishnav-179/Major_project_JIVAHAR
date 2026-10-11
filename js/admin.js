const AdminPanel = {
    API_BASE_URL: 'http://127.0.0.1:5000/api',

    init() {
        this.loadAdminProfile();
        this.loadPendingNGOs();
        
        // Add tab switching logic
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                
                const label = item.innerText || '';
                // Show NGO approval view specifically for "NGO Partners" or "User Management"
                if (label.includes('NGO Partners') || label.includes('User Management')) {
                    const welcomeView = document.getElementById('admin-welcome-view');
                    const approvalView = document.getElementById('ngo-approval-view');
                    if (welcomeView) welcomeView.style.display = 'none';
                    if (approvalView) approvalView.style.display = 'block';
                    this.loadPendingNGOs();
                } else {
                    const welcomeView = document.getElementById('admin-welcome-view');
                    const approvalView = document.getElementById('ngo-approval-view');
                    if (welcomeView) welcomeView.style.display = 'block';
                    if (approvalView) approvalView.style.display = 'none';
                }
            });
        });
    },

    loadAdminProfile() {
        const profileNameEl = document.querySelector('.user-name');
        const profileRoleEl = document.querySelector('.user-role');
        const userAvatarEl = document.querySelector('.user-avatar');

        let name = "System Admin";
        let role = "ADMIN";

        try {
            const userStr = localStorage.getItem('jivahar_user');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user && user.role && user.role.toLowerCase() === 'admin') {
                    name = user.name || "System Admin";
                    role = "ADMIN";
                }
            }
        } catch (e) {
            console.error("Error parsing logged-in admin user:", e);
        }

        if (profileNameEl) {
            profileNameEl.textContent = name;
        }
        if (profileRoleEl) {
            profileRoleEl.textContent = role;
        }
        if (userAvatarEl) {
            userAvatarEl.textContent = name.charAt(0).toUpperCase() || 'A';
        }
    },

    async loadPendingNGOs() {
        const listBody = document.getElementById('pending-ngo-list');
        if (listBody) {
            listBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px;">Loading pending NGOs...</td></tr>';
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}/admin/ngos/pending`);
            const data = await response.json();

            if (data.success) {
                this.renderNGOList(data.ngos || []);
                this.updateNotificationBadges(data.ngos || []);
            } else {
                if (listBody) {
                    listBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: red;">Error: ${data.message}</td></tr>`;
                }
            }
        } catch (error) {
            console.error('Error fetching pending NGOs:', error);
            if (listBody) {
                listBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px; color: red;">Failed to load data. Ensure Flask backend is running on port 5000.</td></tr>`;
            }
        }
    },

    updateNotificationBadges(ngos) {
        const count = ngos.length;
        
        // Update topbar notification badge
        const badgeEl = document.querySelector('.notification-badge');
        if (badgeEl) {
            badgeEl.textContent = count;
            badgeEl.style.display = count > 0 ? 'flex' : 'none';
        }

        // Update Pending NGOs menu badge if present
        const menuBadge = document.querySelector('.menu-item.has-badge .menu-badge');
        if (menuBadge) {
            menuBadge.textContent = count;
        }

        // Update Pending NGOs stat card if present
        const statPendingNgos = document.getElementById('admin-stat-pending-ngos');
        if (statPendingNgos) {
            statPendingNgos.textContent = count;
        }


        // Update admin alert banner
        let alertBanner = document.getElementById('admin-pending-alert-banner');
        const mainContent = document.getElementById('main-content');
        
        if (count > 0) {
            if (!alertBanner && mainContent) {
                alertBanner = document.createElement('div');
                alertBanner.id = 'admin-pending-alert-banner';
                alertBanner.style.cssText = 'background: #fff7ed; border: 1px solid #fdba74; border-radius: 12px; padding: 14px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 8px rgba(0,0,0,0.04);';
                mainContent.insertBefore(alertBanner, mainContent.firstChild);
            }
            if (alertBanner) {
                alertBanner.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 36px; height: 36px; border-radius: 50%; background: #ffedd5; color: #c2410c; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
                            <i class="fa-solid fa-bell"></i>
                        </div>
                        <div>
                            <strong style="color: #9a3412; font-size: 14px; display: block;">🔔 New NGO Registration Alert!</strong>
                            <span style="color: #c2410c; font-size: 12px;">You have <strong>${count} NGO registration(s)</strong> waiting for Admin review and approval.</span>
                        </div>
                    </div>
                    <button class="btn-login-submit" style="padding: 8px 16px; width: auto; font-size: 12px; background: #c2410c; border: none;" onclick="AdminPanel.showApprovalView()">
                        Review Applications
                    </button>
                `;
                alertBanner.style.display = 'flex';
            }
        } else if (alertBanner) {
            alertBanner.style.display = 'none';
        }
    },

    showApprovalView() {
        const welcomeView = document.getElementById('admin-welcome-view');
        const approvalView = document.getElementById('ngo-approval-view');
        if (welcomeView) welcomeView.style.display = 'none';
        if (approvalView) approvalView.style.display = 'block';
        
        // Highlight NGO Partners menu tab
        document.querySelectorAll('.menu-item').forEach(el => {
            if (el.innerText.includes('NGO Partners')) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        this.loadPendingNGOs();
    },

    renderNGOList(ngos) {
        const listBody = document.getElementById('pending-ngo-list');
        if (!listBody) return;
        listBody.innerHTML = '';

        if (!ngos || ngos.length === 0) {
            listBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 24px; color: var(--dash-text-muted); font-weight: 500;">✨ No pending NGOs to approve. All NGO applications are up to date!</td></tr>';
            return;
        }

        ngos.forEach(ngo => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid var(--dash-border)';
            
            row.innerHTML = `
                <td style="padding: 16px 12px; font-weight: 700; color: var(--dash-text-main);">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:32px; height:32px; border-radius:8px; background:#e0f2fe; color:#0369a1; display:flex; align-items:center; justify-content:center;">
                            <i class="fa-solid fa-building-ngo"></i>
                        </div>
                        ${ngo.name}
                    </div>
                </td>
                <td style="padding: 16px 12px; color: var(--dash-text-muted);">${ngo.email}</td>
                <td style="padding: 16px 12px; color: var(--dash-text-muted);">${ngo.phone || 'N/A'}</td>
                <td style="padding: 16px 12px;">
                    <button class="btn-login-submit" style="padding: 8px 16px; width: auto; font-size: 12px; background: #15803d; border: none; border-radius: 8px; cursor: pointer; color: white; font-weight: 600;" onclick="AdminPanel.approveNGO('${ngo._id}')">
                        <i class="fa-solid fa-check"></i> Approve NGO
                    </button>
                </td>
            `;
            listBody.appendChild(row);
        });
    },

    async approveNGO(id) {
        if (!confirm('Are you sure you want to approve this NGO application?')) return;

        try {
            const response = await fetch(`${this.API_BASE_URL}/admin/ngos/approve/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const data = await response.json();

            if (data.success) {
                alert('✅ NGO Approved successfully! Account is now active.');
                this.loadPendingNGOs(); // Refresh pending list & badges
            } else {
                alert(`❌ Failed: ${data.message}`);
            }
        } catch (error) {
            console.error('Error approving NGO:', error);
            alert('❌ Network error occurred while approving NGO.');
        }
    }
};

// Initialize Admin Panel on load
document.addEventListener('DOMContentLoaded', () => {
    AdminPanel.init();
});
