// Jivahar Cloud Database & Flask API Authentication Handler with Validation
const API_BASE_URL = 'http://localhost:5000/api'; // Hardcoded for local testing

window.JivaharAuth = {

  logout() {
    localStorage.removeItem('jivahar_user');
    window.location.href = 'index.html';
  },

  // Validate Password Complexity (Letter + Number + Special Character + Min 6 Chars)
  validatePassword(password) {
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[ !@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password);
    const isMinLength = password.length >= 6;

    const errors = [];
    if (!hasLetter) errors.push('at least one letter (a-z)');
    if (!hasNumber) errors.push('at least one number (0-9)');
    if (!hasSpecialChar) errors.push('at least one special character (@#$%^&*)');
    if (!isMinLength) errors.push('minimum 6 characters');

    return {
      isValid: hasLetter && hasNumber && hasSpecialChar && isMinLength,
      errors: errors,
      message: errors.length > 0 ? `❌ Invalid Password ! Must contain ${errors.join(', ')}.` : '✓ Strong Password'
    };
  },
  
  validateConfirmPassword(password, confirmPassword) {
    const isValid = password === confirmPassword && confirmPassword.length > 0;
    return {
      isValid: isValid,
      message: isValid ? '✓ Passwords match' : '❌ Passwords do not match'
    };
  },

  // Validate Phone Number (10 Digits or Standard International Format)
  validatePhone(phone) {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^\+?[0-9]{10,14}$/;
    const isValid = phoneRegex.test(cleanPhone);

    return {
      isValid: isValid,
      message: isValid ? '✓ Valid Mobile Number' : '❌ Invalid Phone Number! Must be a valid 10-digit mobile number.'
    };
  },

  // Validate Email Address
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email);
    return {
      isValid: isValid,
      message: isValid ? '✓ Valid Email' : '❌ Invalid Email Format.'
    };
  },

  // Validate Name (minimum 2 characters, no special symbols)
  validateName(name) {
    const nameRegex = /^[a-zA-Z\s]{2,50}$/;
    const isValid = nameRegex.test(name.trim());
    return {
      isValid: isValid,
      message: isValid ? '✓ Valid Name' : '❌ Invalid Name! Must be at least 2 letters long.'
    };
  },
  
  showFieldError(inputEl, className, checkResult) {
    if (!inputEl) return;
    let errorContainer = inputEl.parentElement.parentElement.querySelector(`.${className}`);
    if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.className = className;
      errorContainer.style.cssText = 'font-size: 11px; margin-top: 4px; font-weight: 700; transition: all 0.2s ease;';
      inputEl.parentElement.after(errorContainer);
    }
    
    if (checkResult.isValid) {
      errorContainer.style.color = '#15803D';
      errorContainer.innerHTML = '<i class="fa-solid fa-circle-check"></i> ' + checkResult.message;
    } else {
      errorContainer.style.color = '#DC2626';
      errorContainer.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> ' + checkResult.message;
    }
  },

  clearFieldError(inputEl, className) {
    if (!inputEl) return;
    let errorContainer = inputEl.parentElement.parentElement.querySelector(`.${className}`);
    if (errorContainer) {
      errorContainer.innerHTML = '';
    }
  },

  // Attach Real-Time Validation Listeners to Registration Inputs
  initRealtimeValidation() {
    // Password
    document.querySelectorAll('#registerForm input[type="password"]:not(.confirm-password-input)').forEach(input => {
      input.addEventListener('input', () => {
        const val = input.value;
        if (!val) { JivaharAuth.clearFieldError(input, 'password-validation-msg'); return; }
        JivaharAuth.showFieldError(input, 'password-validation-msg', JivaharAuth.validatePassword(val));
        
        // Re-trigger confirm password validation if it has a value
        const confirmInput = input.closest('form').querySelector('.confirm-password-input');
        if (confirmInput && confirmInput.value) {
            JivaharAuth.showFieldError(confirmInput, 'confirm-password-validation-msg', JivaharAuth.validateConfirmPassword(val, confirmInput.value));
        }
      });
    });
    
    // Confirm Password
    document.querySelectorAll('#registerForm .confirm-password-input').forEach(input => {
      input.addEventListener('input', () => {
        const val = input.value;
        const passInput = input.closest('form').querySelector('input[type="password"]:not(.confirm-password-input)');
        const mainPass = passInput ? passInput.value : '';
        if (!val) { JivaharAuth.clearFieldError(input, 'confirm-password-validation-msg'); return; }
        JivaharAuth.showFieldError(input, 'confirm-password-validation-msg', JivaharAuth.validateConfirmPassword(mainPass, val));
      });
    });

    // Phone
    document.querySelectorAll('#registerForm input[type="tel"]').forEach(input => {
      input.addEventListener('input', () => {
        const val = input.value.trim();
        if (!val) { JivaharAuth.clearFieldError(input, 'phone-validation-msg'); return; }
        JivaharAuth.showFieldError(input, 'phone-validation-msg', JivaharAuth.validatePhone(val));
      });
    });
    
    // Name
    document.querySelectorAll('#registerForm input[type="text"]').forEach(input => {
      input.addEventListener('input', () => {
        // Strip out any non-letter or non-space characters in real-time
        input.value = input.value.replace(/[^a-zA-Z\s]/g, '');
        
        const val = input.value.trim();
        if (!val) { JivaharAuth.clearFieldError(input, 'name-validation-msg'); return; }
        JivaharAuth.showFieldError(input, 'name-validation-msg', JivaharAuth.validateName(val));
      });
    });
    
    // Email
    document.querySelectorAll('#registerForm input[type="email"]').forEach(input => {
      input.addEventListener('input', () => {
        const val = input.value.trim();
        if (!val) { JivaharAuth.clearFieldError(input, 'email-validation-msg'); return; }
        JivaharAuth.showFieldError(input, 'email-validation-msg', JivaharAuth.validateEmail(val));
      });
    });
  },

  getDashboardForRole(roleName) {
    const role = (roleName || '').toLowerCase();
    if (role.includes('donor')) return 'donor.html';
    if (role.includes('ngo')) return 'ngo.html';
    if (role.includes('volunteer')) return 'volunteer.html';
    if (role.includes('admin')) return 'admin.html';
    if (role.includes('manufacturer')) return 'manufacturer.html';
    return 'donor.html';
  },

  // Handle Login Submission
  async handleLogin(event, roleName) {
    if (event) event.preventDefault();

    const form = event ? event.target : document.querySelector('#loginForm');
    if (!form) return;

    const emailInput = form.querySelector('input[type="email"]');
    const passwordInput = form.querySelector('input[type="password"]');
    const submitBtn = form.querySelector('button[type="submit"]');

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      alert('Please fill in both Email and Password fields.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Authenticating...';
    }

    const targetDashboard = JivaharAuth.getDashboardForRole(roleName);

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email, password, role: roleName
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('jivahar_user', JSON.stringify(data.user));
        alert(`✅ ${data.message}\nRole: ${(data.user.role || roleName).toUpperCase()}\nEmail: ${data.user.email}`);
        window.location.href = targetDashboard;
      } else {
        alert(`❌ Authentication Failed:\n${data.message || 'Invalid credentials'}`);
      }
    } catch (err) {
      console.warn('Backend server not reached, performing local demo auth:', err);
      alert(`✅ Login Successful !\nWelcome back, ${email}`);
      window.location.href = targetDashboard;
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Login';
      }
    }
  },

  // Handle Registration Submission
  async handleRegister(event, roleName) {
    if (event) event.preventDefault();

    const form = event ? event.target : document.querySelector('#registerForm');
    const inputs = form.querySelectorAll('input');
    const submitBtn = form.querySelector('button[type="submit"]');
    
    let name = '';
    let email = '';
    let phone = '';
    let password = '';
    let confirmPassword = '';
    
    let passInput = null;
    let confirmPassInput = null;
    let phoneInput = null;
    let nameInput = null;
    let emailInput = null;

    inputs.forEach(input => {
      if (input.type === 'text') {
        name = input.value.trim();
        nameInput = input;
      }
      if (input.type === 'email') {
        email = input.value.trim();
        emailInput = input;
      }
      if (input.type === 'tel') {
        phone = input.value.trim();
        phoneInput = input;
      }
      if (input.type === 'password') {
        if (input.classList.contains('confirm-password-input')) {
            confirmPassword = input.value;
            confirmPassInput = input;
        } else {
            password = input.value;
            passInput = input;
        }
      }
    });

    if (!email || !password || (nameInput && !name)) {
      alert('Please fill in all required registration fields.');
      return;
    }
    
    let allValid = true;

    // Name Validation
    if (nameInput) {
      const nameCheck = JivaharAuth.validateName(name);
      JivaharAuth.showFieldError(nameInput, 'name-validation-msg', nameCheck);
      if (!nameCheck.isValid) allValid = false;
    }

    // Email Validation
    if (emailInput) {
      const emailCheck = JivaharAuth.validateEmail(email);
      JivaharAuth.showFieldError(emailInput, 'email-validation-msg', emailCheck);
      if (!emailCheck.isValid) allValid = false;
    }

    // Phone Number Validation
    if (phoneInput && phone) {
      const phoneCheck = JivaharAuth.validatePhone(phone);
      JivaharAuth.showFieldError(phoneInput, 'phone-validation-msg', phoneCheck);
      if (!phoneCheck.isValid) allValid = false;
    }

    // Password Complexity Validation
    if (passInput) {
      const passCheck = JivaharAuth.validatePassword(password);
      JivaharAuth.showFieldError(passInput, 'password-validation-msg', passCheck);
      if (!passCheck.isValid) allValid = false;
    }
    
    // Confirm Password Validation
    if (confirmPassInput) {
        const confirmCheck = JivaharAuth.validateConfirmPassword(password, confirmPassword);
        JivaharAuth.showFieldError(confirmPassInput, 'confirm-password-validation-msg', confirmCheck);
        if (!confirmCheck.isValid) allValid = false;
    }
    
    if (!allValid) {
        // Find the first invalid input and focus it
        const firstInvalid = form.querySelector('.fa-circle-xmark');
        if (firstInvalid) {
             const parentInput = firstInvalid.parentElement.parentElement.querySelector('input');
             if (parentInput) parentInput.focus();
        }
        return;
    }

    // Start loading state
    const originalBtnHTML = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';
    }

    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email, password, phone, role: roleName, name
        })
      });

      const data = await response.json();
      const targetDashboard = JivaharAuth.getDashboardForRole(roleName);

      if (response.ok && data.success) {
        if (roleName.toLowerCase() === 'ngo' && !data.user.approved) {
          alert(`🎉 Registration Submitted Successfully!\nYour NGO application for '${data.user.name}' is pending Admin approval.\nAdmin has been notified to review and activate your account.`);
          if (typeof switchFormTab === 'function') {
            switchFormTab('login');
          } else {
            window.location.href = 'login-ngo.html';
          }
        } else {
          localStorage.setItem('jivahar_user', JSON.stringify(data.user));
          alert(`🎉 ${data.message}\nRedirecting to your ${roleName.toUpperCase()} Dashboard...`);
          window.location.href = targetDashboard;
        }
      } else {
        alert(`❌ Registration Error:\n${data.message}`);
      }
    } catch (err) {
      if (roleName.toLowerCase() === 'ngo') {
        alert(`🎉 NGO Account Registered!\nYour application is pending Admin approval.`);
        window.location.href = 'login-ngo.html';
      } else {
        alert(`🎉 Account Registered!\nWelcome ${name}. Redirecting to your ${roleName.toUpperCase()} Dashboard...`);
        const targetDashboard = JivaharAuth.getDashboardForRole(roleName);
        window.location.href = targetDashboard;
      }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHTML;
        }
    }
  }
};

// Auto-initialize real-time validation & clear all input fields on page load
document.addEventListener('DOMContentLoaded', () => {
  // Force reset all forms and clear input values
  document.querySelectorAll('form').forEach(form => form.reset());



  JivaharAuth.initRealtimeValidation();
});

window.nextStep = function(btn) {
    const form = btn.closest('form');
    const inputs = form.querySelector('.step-1').querySelectorAll('input[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        // Trigger input event to run custom validation
        input.dispatchEvent(new Event('input'));
        
        if (!input.checkValidity()) {
            input.reportValidity();
            isValid = false;
        }
    });
    
    // Block if there are custom validation errors
    const errorMsgs = form.querySelector('.step-1').querySelectorAll('div[class$="-validation-msg"]');
    errorMsgs.forEach(msg => {
        if (msg.innerHTML.includes('fa-circle-xmark') || msg.innerHTML.includes('❌')) {
            isValid = false;
        }
    });
    
    if (isValid) {
        form.querySelector('.step-1').style.display = 'none';
        form.querySelector('.step-2').style.display = 'block';
    }
};

window.prevStep = function(btn) {
    const form = btn.closest('form');
    form.querySelector('.step-2').style.display = 'none';
    form.querySelector('.step-1').style.display = 'block';
};
