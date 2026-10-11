/**
 * Jivahar - Create Donation Workflow
 * State Management & UI Rendering
 */

const DonationApp = {
    state: {
        foodItems: [],
        pickup: {
            address: '',
            city: '',
            pincode: '',
            contact: '',
            phone: '',
            date: '',
            slot: ''
        },
        additional: {
            instructions: '',
            largeVehicle: false
        },
        currentStep: 1,
        editingItemId: null // Holds ID if editing an existing item
    },

    init() {
        this.loadState();
        this.cacheDOM();
        this.bindEvents();
        this.renderStep();
        this.renderFoodItems();
    },

    cacheDOM() {
        // Steps
        this.steps = [1, 2, 3, 4].map(i => document.getElementById(`step${i}-view`));
        this.stepIndicators = document.querySelectorAll('.stepper-container .step');
        
        // Buttons
        this.btnNext = document.getElementById('btn-next');
        this.btnBack = document.getElementById('btn-back');
        this.btnSubmit = document.getElementById('btn-submit');
        
        // Modal
        this.modal = document.getElementById('food-modal');
        this.btnAddFood = document.getElementById('add-food-btn');
        this.btnModalClose = document.getElementById('modal-close-btn');
        this.btnModalCancel = document.getElementById('modal-cancel-btn');
        this.btnModalSave = document.getElementById('modal-save-btn');
        
        // Confirm Modal
        this.confirmModal = document.getElementById('confirm-modal');
        this.btnConfirmClose = document.getElementById('confirm-close-btn');
        this.btnConfirmCancel = document.getElementById('confirm-cancel-btn');
        this.btnConfirmYes = document.getElementById('confirm-yes-btn');
        this.itemToRemove = null;

        // Lists
        this.foodItemsList = document.getElementById('food-items-list');
        this.summaryItemsList = document.getElementById('summary-items-list');
        
        // Form Inputs (Pickup)
        this.pickupAddress = document.getElementById('pickup-address');
        this.pickupCity = document.getElementById('pickup-city');
        this.pickupPincode = document.getElementById('pickup-pincode');
        this.pickupContact = document.getElementById('pickup-contact');
        this.pickupPhone = document.getElementById('pickup-phone');
        this.pickupDate = document.getElementById('pickup-date');
        this.timeSlots = document.querySelectorAll('.time-slot-card');

        // Form Inputs (Additional)
        this.addInstructions = document.getElementById('additional-instructions');
        this.addVehicle = document.getElementById('additional-vehicle');
    },

    bindEvents() {
        this.btnNext.addEventListener('click', () => this.nextStep());
        this.btnBack.addEventListener('click', () => this.prevStep());
        this.btnSubmit.addEventListener('click', () => this.submitDonation());

        this.btnAddFood.addEventListener('click', () => this.openModal());
        this.btnModalClose.addEventListener('click', () => this.closeModal());
        this.btnModalCancel.addEventListener('click', () => this.closeModal());
        this.btnModalSave.addEventListener('click', () => this.saveFoodItem());

        this.btnConfirmClose.addEventListener('click', () => this.closeConfirmModal());
        this.btnConfirmCancel.addEventListener('click', () => this.closeConfirmModal());
        this.btnConfirmYes.addEventListener('click', () => this.removeFoodItem());

        this.timeSlots.forEach(slot => {
            slot.addEventListener('click', (e) => {
                this.timeSlots.forEach(s => s.classList.remove('selected'));
                e.target.classList.add('selected');
                this.state.pickup.slot = e.target.dataset.slot;
                this.saveState();
                this.renderPickupSummary();
            });
        });

        // Sync Pickup Form to State
        ['address', 'city', 'pincode', 'contact', 'phone', 'date'].forEach(field => {
            const el = document.getElementById(`pickup-${field}`);
            if(el) {
                el.addEventListener('input', (e) => {
                    this.state.pickup[field] = e.target.value;
                    this.saveState();
                    this.renderPickupSummary();
                });
            }
        });

        // Sync Additional Form to State
        this.addInstructions.addEventListener('input', (e) => {
            this.state.additional.instructions = e.target.value;
            this.saveState();
        });
        this.addVehicle.addEventListener('change', (e) => {
            this.state.additional.largeVehicle = e.target.checked;
            this.saveState();
        });
    },

    // --- State Persistence ---
    loadState() {
        const saved = localStorage.getItem('jivahar_donation_draft');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.state = { ...this.state, ...parsed };
                // Restore form values
                setTimeout(() => this.populateFormsFromState(), 0);
            } catch(e) {
                console.error("Could not parse draft state", e);
            }
        }
    },
    saveState() {
        localStorage.setItem('jivahar_donation_draft', JSON.stringify(this.state));
    },
    populateFormsFromState() {
        if(this.state.pickup.address) this.pickupAddress.value = this.state.pickup.address;
        if(this.state.pickup.city) this.pickupCity.value = this.state.pickup.city;
        if(this.state.pickup.pincode) this.pickupPincode.value = this.state.pickup.pincode;
        if(this.state.pickup.contact) this.pickupContact.value = this.state.pickup.contact;
        if(this.state.pickup.phone) this.pickupPhone.value = this.state.pickup.phone;
        if(this.state.pickup.date) this.pickupDate.value = this.state.pickup.date;
        if(this.state.pickup.slot) {
            this.timeSlots.forEach(s => {
                if(s.dataset.slot === this.state.pickup.slot) s.classList.add('selected');
            });
        }
        if(this.state.additional.instructions) this.addInstructions.value = this.state.additional.instructions;
        if(this.state.additional.largeVehicle) this.addVehicle.checked = this.state.additional.largeVehicle;
        this.renderPickupSummary();
    },

    // --- Navigation ---
    renderStep() {
        // Update Views
        this.steps.forEach((view, index) => {
            if (index + 1 === this.state.currentStep) {
                view.style.display = 'block';
            } else {
                view.style.display = 'none';
            }
        });

        // Update Indicators
        this.stepIndicators.forEach((ind, index) => {
            const stepNum = index + 1;
            ind.classList.remove('active', 'completed');
            if (stepNum < this.state.currentStep) {
                ind.classList.add('completed');
                ind.querySelector('.step-circle').innerHTML = '<i class="fa-solid fa-check"></i>';
            } else if (stepNum === this.state.currentStep) {
                ind.classList.add('active');
                ind.querySelector('.step-circle').innerHTML = stepNum;
            } else {
                ind.querySelector('.step-circle').innerHTML = stepNum;
            }
        });

        // Update Buttons
        this.btnBack.style.display = this.state.currentStep > 1 ? 'flex' : 'none';
        if (this.state.currentStep === 4) {
            this.btnNext.style.display = 'none';
            this.btnSubmit.style.display = 'flex';
            this.renderReview();
        } else {
            this.btnNext.style.display = 'flex';
            this.btnSubmit.style.display = 'none';
        }

        // Sidebar Styling
        const pSummary = document.getElementById('pickup-summary-card');
        if(this.state.currentStep >= 2) {
            pSummary.style.opacity = '1';
        } else {
            pSummary.style.opacity = '0.5';
        }

        this.saveState();
    },
    
    validateStep1() {
        if (this.state.foodItems.length === 0) {
            alert("Please add at least one food item to continue.");
            return false;
        }
        return true;
    },

    validateStep2() {
        let isValid = true;
        ['address', 'city', 'pincode', 'contact', 'phone', 'date'].forEach(field => {
            const val = this.state.pickup[field];
            const errEl = document.getElementById(`err-pickup-${field}`);
            if (!val || val.trim() === '') {
                errEl.innerText = "Required field";
                isValid = false;
            } else {
                errEl.innerText = "";
            }
        });
        
        const slotErr = document.getElementById('err-pickup-slot');
        if (!this.state.pickup.slot) {
            slotErr.innerText = "Please select a time slot";
            isValid = false;
        } else {
            slotErr.innerText = "";
        }
        return isValid;
    },

    nextStep() {
        if (this.state.currentStep === 1 && !this.validateStep1()) return;
        if (this.state.currentStep === 2 && !this.validateStep2()) return;

        if (this.state.currentStep < 4) {
            this.state.currentStep++;
            this.renderStep();
            window.scrollTo(0,0);
        }
    },
    prevStep() {
        if (this.state.currentStep > 1) {
            this.state.currentStep--;
            this.renderStep();
            window.scrollTo(0,0);
        }
    },
    jumpToStep(step) {
        this.state.currentStep = step;
        this.renderStep();
    },

    // --- Modal Logic ---
    openModal(item = null) {
        this.clearModalErrors();
        
        if (item) {
            document.getElementById('modal-title').innerText = "Edit Food Item";
            this.state.editingItemId = item.id;
            document.getElementById('modal-name').value = item.name;
            document.getElementById('modal-category').value = item.category;
            document.getElementById('modal-type').value = item.type;
            document.getElementById('modal-qty').value = item.qty;
            document.getElementById('modal-unit').value = item.unit;
            document.getElementById('modal-packages').value = item.packages;
            document.getElementById('modal-prepared').value = item.prepared;
            document.getElementById('modal-bestbefore').value = item.bestBefore;
            document.getElementById('modal-packaging').value = item.packaging;
            document.getElementById('modal-desc').value = item.desc;
        } else {
            document.getElementById('modal-title').innerText = "Add Food Item";
            this.state.editingItemId = null;
            // Clear fields
            ['name','category','type','qty','unit','packages','prepared','bestbefore','packaging','desc'].forEach(id => {
                document.getElementById(`modal-${id}`).value = '';
            });
        }
        this.modal.style.display = 'flex';
    },
    closeModal() {
        this.modal.style.display = 'none';
    },
    clearModalErrors() {
        document.querySelectorAll('#food-modal .error-msg').forEach(el => el.innerText = '');
    },
    saveFoodItem() {
        this.clearModalErrors();
        
        const name = document.getElementById('modal-name').value.trim();
        const category = document.getElementById('modal-category').value;
        const type = document.getElementById('modal-type').value;
        const qty = document.getElementById('modal-qty').value;
        const unit = document.getElementById('modal-unit').value;
        const packages = document.getElementById('modal-packages').value;
        const prepared = document.getElementById('modal-prepared').value;
        const bestBefore = document.getElementById('modal-bestbefore').value;
        const packaging = document.getElementById('modal-packaging').value;
        const desc = document.getElementById('modal-desc').value;

        let isValid = true;
        if (!name) { document.getElementById('err-modal-name').innerText = 'Required'; isValid = false; }
        if (!category) { document.getElementById('err-modal-category').innerText = 'Required'; isValid = false; }
        if (!type) { document.getElementById('err-modal-type').innerText = 'Required'; isValid = false; }
        if (!qty || qty <= 0) { document.getElementById('err-modal-qty').innerText = 'Valid quantity required'; isValid = false; }
        if (!unit) { document.getElementById('err-modal-unit').innerText = 'Required'; isValid = false; }
        if (!packages || packages <= 0) { document.getElementById('err-modal-packages').innerText = 'Required'; isValid = false; }
        if (!prepared) { document.getElementById('err-modal-prepared').innerText = 'Required'; isValid = false; }
        if (!bestBefore) { document.getElementById('err-modal-bestbefore').innerText = 'Required'; isValid = false; }
        
        // Basic date validation
        if (prepared && bestBefore && new Date(bestBefore) <= new Date(prepared)) {
            document.getElementById('err-modal-bestbefore').innerText = 'Must be after prepared time';
            isValid = false;
        }

        if (!isValid) return;

        const itemObj = {
            id: this.state.editingItemId || 'item_' + Date.now().toString(),
            name, category, type, qty, unit, packages, prepared, bestBefore, packaging, desc
        };

        if (this.state.editingItemId) {
            const index = this.state.foodItems.findIndex(i => i.id === this.state.editingItemId);
            if(index !== -1) this.state.foodItems[index] = itemObj;
        } else {
            this.state.foodItems.push(itemObj);
        }

        this.saveState();
        this.renderFoodItems();
        this.closeModal();
    },

    // --- Remove Confirmation ---
    confirmRemove(id) {
        this.itemToRemove = id;
        this.confirmModal.style.display = 'flex';
    },
    closeConfirmModal() {
        this.itemToRemove = null;
        this.confirmModal.style.display = 'none';
    },
    removeFoodItem() {
        if(this.itemToRemove) {
            this.state.foodItems = this.state.foodItems.filter(i => i.id !== this.itemToRemove);
            this.saveState();
            this.renderFoodItems();
        }
        this.closeConfirmModal();
    },

    // --- Rendering ---
    formatDate(dateString) {
        if(!dateString) return '';
        const d = new Date(dateString);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' • ' + 
               d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    },

    renderFoodItems() {
        if (this.state.foodItems.length === 0) {
            this.foodItemsList.innerHTML = `
                <div style="text-align:center; padding: 40px; background:#f8fafc; border-radius:12px; border:2px dashed #e2e8f0;">
                    <i class="fa-solid fa-bowl-food" style="font-size:32px; color:#94a3b8; margin-bottom:12px;"></i>
                    <h3 style="margin:0 0 4px 0; color:#475569; font-size:15px;">No food items added yet</h3>
                    <p style="margin:0; font-size:13px; color:#64748b;">Click the button below to add items to this donation.</p>
                </div>
            `;
        } else {
            this.foodItemsList.innerHTML = this.state.foodItems.map(item => `
                <div class="food-item-card">
                    <img src="https://via.placeholder.com/80?text=Food" class="food-item-img" alt="Food">
                    <div class="food-item-details">
                        <h4>${item.name}</h4>
                        <div class="food-badges">
                            <span class="badge-soft green">${item.category}</span>
                            <span class="badge-soft green">${item.type}</span>
                        </div>
                        <div class="food-meta">
                            <span><strong>${item.qty} ${item.unit}</strong> • ${item.packages} packages</span>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:12px; font-size:12px; color:#64748b;">
                            <div><i class="fa-regular fa-clock"></i> <strong>Prepared:</strong><br>${this.formatDate(item.prepared)}</div>
                            <div><i class="fa-solid fa-hourglass-end"></i> <strong>Best Before:</strong><br>${this.formatDate(item.bestBefore)}</div>
                        </div>
                    </div>
                    <div class="food-item-actions">
                        <span class="badge-soft" style="background:#dcfce7; color:#166534;"><i class="fa-solid fa-circle" style="font-size:8px;"></i> Available</span>
                        <div style="display:flex; gap:8px; margin-top:12px;">
                            <button class="btn-small-outline" onclick="DonationApp.openModal(${JSON.stringify(item).replace(/"/g, '&quot;')})"><i class="fa-solid fa-pen"></i> Edit</button>
                            <button class="btn-small-outline danger" onclick="DonationApp.confirmRemove('${item.id}')"><i class="fa-regular fa-trash-can"></i> Remove</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        this.renderSummary();
    },

    renderSummary() {
        const count = this.state.foodItems.length;
        document.getElementById('summary-item-count').innerText = `${count} Food Items`;
        
        if (count === 0) {
            this.summaryItemsList.innerHTML = `<p style="font-size:12px; color:#64748b; text-align:center;">Add items to see summary.</p>`;
            document.getElementById('summary-total-packages').innerText = '0';
            document.getElementById('summary-total-food-items').innerText = '0';
            document.getElementById('view-all-items-btn').style.display = 'none';
            return;
        }

        // Mini list (show max 3, then "View all")
        const preview = this.state.foodItems.slice(0, 3);
        this.summaryItemsList.innerHTML = preview.map(item => `
            <div class="summary-item-row">
                <img src="https://via.placeholder.com/40" class="summary-item-thumb">
                <div class="summary-item-text">
                    <h5>${item.name}</h5>
                    <p>${item.qty} ${item.unit} • ${item.packages} packages</p>
                </div>
            </div>
        `).join('');

        if (count > 3) {
            document.getElementById('view-all-items-btn').style.display = 'block';
        } else {
            document.getElementById('view-all-items-btn').style.display = 'none';
        }

        let totalPackages = 0;
        this.state.foodItems.forEach(i => totalPackages += parseInt(i.packages));

        document.getElementById('summary-total-packages').innerText = totalPackages;
        document.getElementById('summary-total-food-items').innerText = count;
    },

    renderPickupSummary() {
        const p = this.state.pickup;
        document.getElementById('summary-address').innerText = p.address ? `${p.address}, ${p.city} - ${p.pincode}` : 'Not provided';
        document.getElementById('summary-date').innerText = p.date ? new Date(p.date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '-';
        document.getElementById('summary-slot').innerText = p.slot || '-';
        
        let contactHtml = '-';
        if(p.contact) {
            contactHtml = `${p.contact}<br><span style="font-size:11px; font-weight:normal; color:var(--dash-text-muted);">${p.phone}</span>`;
        }
        document.getElementById('summary-contact').innerHTML = contactHtml;
    },

    renderReview() {
        const container = document.getElementById('review-container');
        
        let foodHtml = this.state.foodItems.map(i => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px dashed #e2e8f0; font-size:13px;">
                <strong>${i.name}</strong>
                <span>${i.qty} ${i.unit} (${i.packages} pkgs)</span>
            </div>
        `).join('');

        const p = this.state.pickup;
        
        container.innerHTML = `
            <div style="background:#f8fafc; border-radius:12px; padding:20px; border:1px solid #e2e8f0; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="font-size:15px; margin:0;"><i class="fa-solid fa-bowl-food"></i> Food Items (${this.state.foodItems.length})</h3>
                    <button class="btn-small-outline" onclick="DonationApp.jumpToStep(1)">Edit</button>
                </div>
                ${foodHtml}
            </div>

            <div style="background:#f8fafc; border-radius:12px; padding:20px; border:1px solid #e2e8f0; margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="font-size:15px; margin:0;"><i class="fa-solid fa-location-dot"></i> Pickup Details</h3>
                    <button class="btn-small-outline" onclick="DonationApp.jumpToStep(2)">Edit</button>
                </div>
                <p style="font-size:13px; margin:0 0 8px 0;"><strong>Address:</strong> ${p.address}, ${p.city} - ${p.pincode}</p>
                <p style="font-size:13px; margin:0 0 8px 0;"><strong>Schedule:</strong> ${p.date} | ${p.slot}</p>
                <p style="font-size:13px; margin:0;"><strong>Contact:</strong> ${p.contact} (${p.phone})</p>
            </div>
            
            <div style="background:#f8fafc; border-radius:12px; padding:20px; border:1px solid #e2e8f0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <h3 style="font-size:15px; margin:0;"><i class="fa-solid fa-list-check"></i> Additional Info</h3>
                    <button class="btn-small-outline" onclick="DonationApp.jumpToStep(3)">Edit</button>
                </div>
                <p style="font-size:13px; margin:0 0 8px 0;"><strong>Vehicle:</strong> ${this.state.additional.largeVehicle ? 'Large Truck Required' : 'Standard'}</p>
                <p style="font-size:13px; margin:0;"><strong>Instructions:</strong> ${this.state.additional.instructions || 'None'}</p>
            </div>
        `;
    },

    submitDonation() {
        this.btnSubmit.disabled = true;
        this.btnSubmit.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Submitting...`;
        this.btnBack.style.display = 'none';

        // Mock API Call
        setTimeout(() => {
            const donationId = 'DON-' + Math.floor(Math.random() * 9000 + 1000);
            
            // Clear draft
            localStorage.removeItem('jivahar_donation_draft');
            
            // Show Success
            const formCard = document.querySelector('.form-card');
            formCard.innerHTML = `
                <div style="text-align:center; padding: 60px 20px;">
                    <div style="width:80px; height:80px; background:#dcfce7; color:#166534; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:40px; margin: 0 auto 24px auto;">
                        <i class="fa-solid fa-check"></i>
                    </div>
                    <h2 style="font-size:24px; margin:0 0 8px 0;">Donation Submitted!</h2>
                    <p style="color:var(--dash-text-muted); margin:0 0 24px 0;">Thank you for your generous contribution.</p>
                    <div style="background:#f8fafc; border:1px dashed #cbd5e1; padding:16px; border-radius:12px; display:inline-block; margin-bottom:32px;">
                        <span style="font-size:12px; color:#64748b; display:block; margin-bottom:4px;">Tracking ID</span>
                        <strong style="font-size:18px; color:var(--dash-primary);">${donationId}</strong>
                    </div>
                    <div>
                        <button class="btn-primary" style="margin:0 auto;" onclick="window.location.reload()">Create Another Donation</button>
                    </div>
                </div>
            `;
            
            document.querySelector('.stepper-container').style.display = 'none';
            document.querySelector('.step-actions').style.display = 'none';

        }, 1500);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    DonationApp.init();
});
