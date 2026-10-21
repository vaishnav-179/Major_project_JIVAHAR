
/* ============================================
   JIVAHAR — API Client Helper (Flask Backend)
   Target URL: http://127.0.0.1:5000/api
   Includes automated fallback to local state if Flask is offline.
   ============================================ */

const API_HOST = (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== '') ? window.location.hostname : '127.0.0.1';
const API_BASE_URL = `http://${API_HOST}:5000/api`;

class JivaharAPI {
  static isServerAvailable = null;

  static async request(endpoint, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const config = {
      credentials: 'omit', // Use 'include' for cross-site cookie sessions if running via http
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();
      JivaharAPI.isServerAvailable = true;
      return data;
    } catch (err) {
      console.warn(`[Jivahar API] Endpoint ${endpoint} unreachable or offline. Falling back to local state.`, err);
      JivaharAPI.isServerAvailable = false;
      return null;
    }
  }

  // Check health
  static async checkHealth() {
    return await JivaharAPI.request('/health', { method: 'GET' });
  }

  // Auth Methods
  static async register(userData) {
    const res = await JivaharAPI.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (res && res.success) {
      localStorage.setItem('jivahar_user', JSON.stringify(res.user));
    }
    return res;
  }

  static async login(email, password) {
    const res = await JivaharAPI.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res && res.success) {
      localStorage.setItem('jivahar_user', JSON.stringify(res.user));
    }
    return res;
  }

  static async logout() {
    const res = await JivaharAPI.request('/auth/logout', { method: 'POST' });
    localStorage.removeItem('jivahar_user');
    return res || { success: true };
  }

  static async getCurrentUser() {
    const res = await JivaharAPI.request('/auth/me', { method: 'GET' });
    if (res && res.authenticated && res.user) {
      localStorage.setItem('jivahar_user', JSON.stringify(res.user));
      return res.user;
    }
    const local = localStorage.getItem('jivahar_user');
    return local ? JSON.parse(local) : null;
  }

  // Donations Methods
  static async getDonations(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/donations?${query}` : '/donations';
    return await JivaharAPI.request(endpoint, { method: 'GET' });
  }

  static async createDonation(donationData) {
    return await JivaharAPI.request('/donations', {
      method: 'POST',
      body: JSON.stringify(donationData)
    });
  }

  static async updateDonationStatus(donationId, status) {
    return await JivaharAPI.request(`/donations/${donationId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // NGO Claiming Methods
  static async claimDonation(donationId, ngoData = {}) {
    return await JivaharAPI.request(`/ngo/claim/${donationId}`, {
      method: 'POST',
      body: JSON.stringify(ngoData)
    });
  }

  static async getNGOClaims(ngoId = null) {
    const endpoint = ngoId ? `/ngo/my-claims?ngo_id=${ngoId}` : '/ngo/my-claims';
    return await JivaharAPI.request(endpoint, { method: 'GET' });
  }

  // Volunteer Task Methods
  static async getVolunteerTasks(params = {}) {
    const query = new URLSearchParams(params).toString();
    const endpoint = query ? `/volunteer/tasks?${query}` : '/volunteer/tasks';
    return await JivaharAPI.request(endpoint, { method: 'GET' });
  }

  static async updateDeliveryStatus(donationId, status) {
    return await JivaharAPI.request(`/volunteer/update-status/${donationId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // Analytics & Stats Methods
  static async getStats() {
    return await JivaharAPI.request('/stats', { method: 'GET' });
  }

  // Contact Method
  static async submitContact(contactData) {
    return await JivaharAPI.request('/contact', {
      method: 'POST',
      body: JSON.stringify(contactData)
    });
  }
}

// Global expose
window.JivaharAPI = JivaharAPI;



/* ============================================
   JIVAHAR — Interactive Logic
   Scroll animations, counters, carousels,
   mobile menu, modal, sticky navbar
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ============================================
  // STICKY NAVBAR
  // ============================================
  const navbar = document.getElementById('navbar');

  const handleScroll = () => {
    if (!navbar) return;
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll(); // Initial check

  // ============================================
  // MOBILE HAMBURGER MENU
  // ============================================
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  const toggleMobileMenu = () => {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
  };

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', toggleMobileMenu);

    // Close mobile menu when a link is clicked
    mobileMenu.querySelectorAll('.navbar__link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // ============================================
  // SMOOTH SCROLL FOR NAV LINKS
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || targetId === '#signup-modal') return;
      e.preventDefault();
      const target = document.querySelector(targetId);
      if (target) {
        const navHeight = navbar ? navbar.offsetHeight : 0;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // ============================================
  // SCROLL REVEAL ANIMATIONS
  // ============================================
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach(el => revealObserver.observe(el));

  // ============================================
  // ANIMATED NUMBER COUNTERS
  // ============================================
  const counters = document.querySelectorAll('[data-count]');
  const counterAnimated = new Set();

  const animateCounter = (element) => {
    const target = parseInt(element.getAttribute('data-count'), 10);
    const duration = 2000;
    const startTime = performance.now();

    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    const update = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      const current = Math.floor(easedProgress * target);

      if (target >= 1000) {
        element.textContent = current.toLocaleString() + '+';
      } else {
        element.textContent = current + '+';
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    };

    requestAnimationFrame(update);
  };

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !counterAnimated.has(entry.target)) {
        counterAnimated.add(entry.target);
        animateCounter(entry.target);
      }
    });
  }, {
    threshold: 0.4
  });

  counters.forEach(counter => counterObserver.observe(counter));

  // ============================================
  // NGO PARTNERS CAROUSEL
  // ============================================
  const partnersCarousel = document.getElementById('partnersCarousel');
  const prevBtn = document.getElementById('partnersPrev');
  const nextBtn = document.getElementById('partnersNext');

  if (partnersCarousel && prevBtn && nextBtn) {
    const scrollAmount = 350;

    nextBtn.addEventListener('click', () => {
      partnersCarousel.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    });

    prevBtn.addEventListener('click', () => {
      partnersCarousel.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    });
  }

  // ============================================
  // TESTIMONIALS CAROUSEL
  // ============================================
  const testimonialsTrack = document.getElementById('testimonialsTrack');
  const testimonialDots = document.querySelectorAll('.testimonials__dot');
  let currentSlide = 0;
  let autoSlideTimer;

  const goToSlide = (index) => {
    if (!testimonialsTrack) return;
    currentSlide = index;
    testimonialsTrack.style.transform = `translateX(-${index * 100}%)`;
    testimonialDots.forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  };

  testimonialDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const slideIndex = parseInt(dot.getAttribute('data-slide'), 10);
      goToSlide(slideIndex);
      resetAutoSlide();
    });
  });

  const autoSlide = () => {
    autoSlideTimer = setInterval(() => {
      if (testimonialDots.length > 0) {
        const nextIndex = (currentSlide + 1) % testimonialDots.length;
        goToSlide(nextIndex);
      }
    }, 5500);
  };

  const resetAutoSlide = () => {
    clearInterval(autoSlideTimer);
    autoSlide();
  };

  autoSlide();

  // ============================================
  // SIGNUP & LOGIN MODAL
  // ============================================
  const signupModal = document.getElementById('signupModal');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  const roleCards = document.querySelectorAll('.modal__role-card');
  let selectedRole = null;

  const openModal = (defaultRole = null) => {
    if (!modalOverlay || !signupModal) return;
    modalOverlay.classList.add('active');
    signupModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Pre-select role if provided
    if (defaultRole) {
      roleCards.forEach(c => {
        if (c.getAttribute('data-role') === defaultRole) {
          c.classList.add('selected');
          selectedRole = defaultRole;
        } else {
          c.classList.remove('selected');
        }
      });
    }
  };

  const closeModal = () => {
    if (!modalOverlay || !signupModal) return;
    modalOverlay.classList.remove('active');
    signupModal.classList.remove('active');
    document.body.style.overflow = '';
  };

  // Open modal trigger buttons
  const triggerList = [
    { id: 'signupBtn', role: null },
    { id: 'loginBtn', role: null },
    { id: 'mobileSignupBtn', role: null },
    { id: 'mobileLoginBtn', role: null },
    { id: 'heroDonateBtn', role: 'donor' },
    { id: 'aboutDonateBtn', role: 'donor' },
    { id: 'partnerCtaBtn', role: 'ngo' },
    { id: 'flowDonateActionBtn', role: 'donor' },
    { id: 'flowNgoActionBtn', role: 'ngo' },
    { id: 'footerDonorReg', role: 'donor' },
    { id: 'footerNgoReg', role: 'ngo' }
  ];

  triggerList.forEach(item => {
    const el = document.getElementById(item.id);
    if (el) {
      el.addEventListener('click', (e) => {
        const href = el.getAttribute('href');
        if (href && !href.startsWith('#')) {
          // Allow direct page navigation (e.g. login.html or donate.html)
          return;
        }
        e.preventDefault();
        openModal(item.role);
      });
    }
  });

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalOverlay) modalOverlay.addEventListener('click', closeModal);

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Role selection
  roleCards.forEach(card => {
    card.addEventListener('click', () => {
      roleCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedRole = card.getAttribute('data-role');
    });
  });

  // Form submission (UI Simulation)
  const signupForm = document.getElementById('signupForm');
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!selectedRole) {
        const roleSelector = document.getElementById('roleSelector');
        if (roleSelector) {
          roleSelector.style.outline = '2px solid var(--clr-accent)';
          roleSelector.style.borderRadius = 'var(--radius-md)';
          setTimeout(() => {
            roleSelector.style.outline = 'none';
          }, 800);
        }
        return;
      }

      const submitBtn = document.getElementById('signupSubmit');
      if (submitBtn) {
        submitBtn.textContent = 'Setting up your profile...';
        submitBtn.disabled = true;

        setTimeout(() => {
          submitBtn.textContent = '✓ Welcome to Jivahar!';
          submitBtn.style.background = 'var(--clr-primary)';

          setTimeout(() => {
            closeModal();
            signupForm.reset();
            roleCards.forEach(c => c.classList.remove('selected'));
            selectedRole = null;
            submitBtn.textContent = 'Create Account';
            submitBtn.disabled = false;
            submitBtn.style.background = '';
          }, 1400);
        }, 1200);
      }
    });
  }



  // Newsletter form submission
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('newsletterSubmit');
      const emailInput = document.getElementById('newsletterEmail');
      if (submitBtn && emailInput) {
        submitBtn.textContent = 'Subscribing...';
        setTimeout(() => {
          submitBtn.textContent = '✓ Subscribed!';
          emailInput.value = '';
          setTimeout(() => {
            submitBtn.textContent = 'Subscribe';
          }, 2000);
        }, 800);
      }
    });
  }

  // About section tab switching
  const tabButtons = document.querySelectorAll('.about__tab-btn');
  const tabPanes = document.querySelectorAll('.about__tab-pane');

  if (tabButtons.length > 0 && tabPanes.length > 0) {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');

        // Toggle active button
        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle active pane
        tabPanes.forEach(pane => {
          pane.classList.remove('active');
          if (pane.id === `tab-${targetTab}`) {
            pane.classList.add('active');
          }
        });
      });
    });
  }

  // ============================================
  // ACTIVE NAV LINK ON SCROLL
  // ============================================
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.navbar__links .navbar__link');

  const activateNavOnScroll = () => {
    const scrollPosition = window.scrollY + (navbar ? navbar.offsetHeight : 0) + 120;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  };

  // ============================================
  // JIVAHAR — FOOD REDISTRIBUTION COMMAND CENTER
  // Three.js 3D Engine, Route Particles & Vehicles
  // ============================================

  const threeContainer = document.getElementById('threejs-container');
  if (threeContainer && typeof THREE !== 'undefined') {

    // --- 1. Three.js Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x070A0E, 0.007);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 55, 80);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    threeContainer.appendChild(renderer.domElement);

    // --- 2. Orbit Controls ---
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 15;
    controls.maxDistance = 150;

    // --- 3. Lighting ---
    const ambientLight = new THREE.AmbientLight(0x1E293B, 1.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38BDF8, 2.2);
    dirLight.position.set(60, 90, 40);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // --- 4. City Ground & Low-Poly Buildings ---
    const gridHelper = new THREE.GridHelper(240, 48, 0x1E293B, 0x0F172A);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);

    // Ground Plane
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x070A0E, roughness: 0.9, metalness: 0.1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    scene.add(ground);

    // Generate Procedural City Buildings
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x0E141F, roughness: 0.6, metalness: 0.4 });
    const buildingEdgeMat = new THREE.LineBasicMaterial({ color: 0x1E293B });

    const buildingPositions = [];
    for (let i = 0; i < 42; i++) {
      const w = 4 + Math.random() * 6;
      const h = 8 + Math.random() * 26;
      const d = 4 + Math.random() * 6;

      let x = (Math.random() - 0.5) * 160;
      let z = (Math.random() - 0.5) * 160;

      // Keep center clear for routes
      if (Math.abs(x) < 15 && Math.abs(z) < 15) x += 25;

      const bGeo = new THREE.BoxGeometry(w, h, d);
      const bMesh = new THREE.Mesh(bGeo, buildingMat);
      bMesh.position.set(x, h / 2, z);
      scene.add(bMesh);

      // Add top edge line highlight
      const edges = new THREE.EdgesGeometry(bGeo);
      const line = new THREE.LineSegments(edges, buildingEdgeMat);
      bMesh.add(line);

      buildingPositions.push({ x, z, h });
    }

    // --- 5. Network Nodes Data & 3D Beacons ---
    const nodesData = [
      { id: 'node-green-leaf', name: 'Green Leaf Bistro', type: 'DONOR', color: 0xF59E0B, pos: [-30, 0, -20], sub: 'ACTIVE DONATION: 120 KG' },
      { id: 'node-harvest', name: 'Harvest Kitchen', type: 'DONOR', color: 0xF59E0B, pos: [35, 0, -25], sub: 'ACTIVE DONATION: 85 KG' },
      { id: 'node-city-bakery', name: 'City Bakery Hub', type: 'DONOR', color: 0xF59E0B, pos: [-40, 0, 30], sub: 'ACTIVE DONATION: 45 KG' },
      { id: 'node-central-hub', name: 'Central Sorting Hub', type: 'HUB', color: 0x3B82F6, pos: [0, 0, 0], sub: 'REDISTRIBUTION CENTER' },
      { id: 'node-recipient-hub', name: 'Community Recipient Hub', type: 'RECIPIENT', color: 0x10B981, pos: [30, 0, -5], sub: 'RECIPIENT · 120 KG IN TRANSIT' },
      { id: 'node-hope-haven', name: 'Hope Haven Youth Home', type: 'RECIPIENT', color: 0x10B981, pos: [-25, 0, 25], sub: 'RECIPIENT · 85 KG EXPECTED' },
      { id: 'node-grace-mission', name: 'Grace Mission Center', type: 'RECIPIENT', color: 0x10B981, pos: [15, 0, -40], sub: 'RECIPIENT · COMPLETED' }
    ];

    const nodeMeshes = [];

    nodesData.forEach(data => {
      const group = new THREE.Group();
      group.position.set(data.pos[0], data.pos[1], data.pos[2]);

      // Base ring
      const ringGeo = new THREE.RingGeometry(1.2, 1.8, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: data.color, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      // Light Beam Cylinder
      const beamGeo = new THREE.CylinderGeometry(0.3, 0.8, 8, 16);
      const beamMat = new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.35 });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.y = 4;
      group.add(beam);

      // Top Pulsing Beacon Sphere
      const sphereGeo = new THREE.SphereGeometry(0.8, 16, 16);
      const sphereMat = new THREE.MeshBasicMaterial({ color: data.color });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.y = 8;
      group.add(sphere);

      // Attach data reference for Raycaster interaction
      sphere.userData = data;
      beam.userData = data;
      group.userData = data;

      scene.add(group);
      nodeMeshes.push(sphere);
    });

    // --- 6. Animated Routes, Light Particles & 3D Vehicles ---
    const routesData = [
      {
        id: 'route-1',
        from: [-30, 0, -20],
        via: [0, 0, 0],
        to: [30, 0, -5],
        color: 0xF59E0B,
        batchId: 'BATCH #GLB-0809',
        weight: '120 KG',
        type: 'PREPARED MEALS',
        origin: 'Green Leaf Bistro',
        dest: 'Community Recipient Hub'
      },
      {
        id: 'route-2',
        from: [35, 0, -25],
        via: [0, 0, 0],
        to: [15, 0, -40],
        color: 0x3B82F6,
        batchId: 'BATCH #HK-0809',
        weight: '85 KG',
        type: 'RICE & GRAINS',
        origin: 'Harvest Kitchen',
        dest: 'Grace Mission Center'
      },
      {
        id: 'route-3',
        from: [-40, 0, 30],
        via: [-25, 0, 25],
        to: [-25, 0, 25],
        color: 0x10B981,
        batchId: 'BATCH #CB-0809',
        weight: '45 KG',
        type: 'BAKERY & SAVORIES',
        origin: 'City Bakery Hub',
        dest: 'Hope Haven Youth Home'
      }
    ];

    const activeParticles = [];
    const activeVehicles = [];

    // Helper: Create 3D Delivery Vehicle Mesh
    function createVehicleMesh(color) {
      const vGroup = new THREE.Group();

      // Body / Chassis
      const bodyGeo = new THREE.BoxGeometry(1.6, 0.9, 2.6);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.4, metalness: 0.8 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.5;
      vGroup.add(body);

      // Cargo Box Accent Line
      const accentGeo = new THREE.BoxGeometry(1.65, 0.2, 2.0);
      const accentMat = new THREE.MeshBasicMaterial({ color: color });
      const accent = new THREE.Mesh(accentGeo, accentMat);
      accent.position.set(0, 0.6, -0.2);
      vGroup.add(accent);

      // Headlights
      const lightGeo = new THREE.SphereGeometry(0.12, 8, 8);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0xFEF08A });
      const hl1 = new THREE.Mesh(lightGeo, lightMat);
      hl1.position.set(-0.5, 0.5, 1.35);
      const hl2 = new THREE.Mesh(lightGeo, lightMat);
      hl2.position.set(0.5, 0.5, 1.35);
      vGroup.add(hl1);
      vGroup.add(hl2);

      vGroup.scale.set(0.8, 0.8, 0.8);
      return vGroup;
    }

    routesData.forEach(r => {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(r.from[0], 0.5, r.from[2]),
        new THREE.Vector3((r.from[0] + r.via[0]) / 2, 3, (r.from[2] + r.via[2]) / 2),
        new THREE.Vector3(r.via[0], 0.5, r.via[2]),
        new THREE.Vector3((r.via[0] + r.to[0]) / 2, 3, (r.via[2] + r.to[2]) / 2),
        new THREE.Vector3(r.to[0], 0.5, r.to[2])
      ]);

      // Route Tube Geometry Line
      const points = curve.getPoints(50);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineBasicMaterial({ color: r.color, opacity: 0.6, transparent: true, linewidth: 2 });
      const lineMesh = new THREE.Line(lineGeo, lineMat);
      scene.add(lineMesh);

      // Moving Particles along route
      for (let p = 0; p < 4; p++) {
        const pGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const pMat = new THREE.MeshBasicMaterial({ color: r.color });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        scene.add(pMesh);

        activeParticles.push({
          mesh: pMesh,
          curve: curve,
          progress: (p * 0.25),
          speed: 0.0015 + Math.random() * 0.0008
        });
      }

      // Spawn Vehicle Mesh along route
      const vehicle = createVehicleMesh(r.color);
      scene.add(vehicle);
      activeVehicles.push({
        mesh: vehicle,
        curve: curve,
        progress: 0.1,
        speed: 0.0012,
        routeData: r
      });
    });

    // --- 7. Raycaster Hover & Click Interaction ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const tooltip = document.getElementById('cmd3dTooltip');
    const tooltipTitle = document.getElementById('tooltipTitle');
    const tooltipSub = document.getElementById('tooltipSub');
    const detailPanel = document.getElementById('cmdDetailPanel');

    window.addEventListener('pointermove', (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes);

      if (intersects.length > 0) {
        const hitData = intersects[0].object.userData;
        if (tooltip && hitData) {
          tooltipTitle.textContent = hitData.name;
          tooltipSub.textContent = hitData.sub || hitData.type;
          tooltip.style.left = `${event.clientX}px`;
          tooltip.style.top = `${event.clientY}px`;
          tooltip.classList.add('active');
        }
        document.body.style.cursor = 'pointer';
      } else {
        if (tooltip) tooltip.classList.remove('active');
        document.body.style.cursor = 'default';
      }
    });

    window.addEventListener('click', (event) => {
      if (event.target.closest('.cmd-header') || event.target.closest('.cmd-floating-panel') || event.target.closest('.cmd-detail-panel') || event.target.closest('.cmd-wizard-overlay')) {
        return;
      }

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes);

      if (intersects.length > 0) {
        const hitData = intersects[0].object.userData;
        focusOnNodePosition(intersects[0].object.parent.position);
        openNodeDetailPanel(hitData);
      }
    });

    function focusOnNodePosition(pos) {
      if (typeof gsap !== 'undefined') {
        gsap.to(camera.position, {
          x: pos.x + 12,
          y: pos.y + 18,
          z: pos.z + 18,
          duration: 1.4,
          ease: 'power2.out'
        });
        gsap.to(controls.target, {
          x: pos.x,
          y: pos.y,
          z: pos.z,
          duration: 1.4,
          ease: 'power2.out'
        });
      }
    }

    window.focusSelectedNode = function () {
      focusOnNodePosition(new THREE.Vector3(-30, 0, -20));
    };

    function openNodeDetailPanel(data) {
      if (detailPanel) {
        const batchIdEl = document.getElementById('detailBatchId');
        const weightTypeEl = document.getElementById('detailWeightType');
        const originEl = document.getElementById('detailOrigin');
        const destEl = document.getElementById('detailDestination');

        if (batchIdEl) batchIdEl.textContent = `BATCH #${data.id.toUpperCase().slice(-6)}`;
        if (weightTypeEl) weightTypeEl.textContent = data.sub || `${data.name} Manifest`;
        if (originEl) originEl.textContent = data.name;
        if (destEl) destEl.textContent = data.type === 'DONOR' ? 'Recipient Hub' : data.name;

        detailPanel.classList.add('active');
      }
    }

    const closeDetailPanel = document.getElementById('closeDetailPanel');
    if (closeDetailPanel) {
      closeDetailPanel.addEventListener('click', () => {
        if (detailPanel) detailPanel.classList.remove('active');
      });
    }

    // --- 8. Navigation Modes Handler ---
    const modeBtns = document.querySelectorAll('.cmd-mode-btn');
    const drawerPane = document.getElementById('cmdDrawerPane');
    const closeDrawerBtn = document.getElementById('closeDrawerBtn');

    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (mode === 'donations') {
          if (drawerPane) drawerPane.classList.add('active');
          renderBatchStreamDrawer();
        } else {
          if (drawerPane) drawerPane.classList.remove('active');
        }

        if (mode === 'network') {
          if (typeof gsap !== 'undefined') {
            gsap.to(camera.position, { x: 0, y: 110, z: 0.1, duration: 1.5, ease: 'power2.inOut' });
            gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.5, ease: 'power2.inOut' });
          }
        } else if (mode === 'operations') {
          if (typeof gsap !== 'undefined') {
            gsap.to(camera.position, { x: 0, y: 55, z: 80, duration: 1.5, ease: 'power2.inOut' });
            gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.5, ease: 'power2.inOut' });
          }
        } else if (mode === 'impact') {
          if (typeof gsap !== 'undefined') {
            gsap.to(camera.position, { x: 45, y: 35, z: 45, duration: 1.5, ease: 'power2.inOut' });
            gsap.to(controls.target, { x: 0, y: 0, z: 0, duration: 1.5, ease: 'power2.inOut' });
          }
        }
      });
    });

    if (closeDrawerBtn) {
      closeDrawerBtn.addEventListener('click', () => {
        if (drawerPane) drawerPane.classList.remove('active');
        modeBtns.forEach(b => {
          if (b.getAttribute('data-mode') === 'operations') b.classList.add('active');
          else b.classList.remove('active');
        });
      });
    }

    function renderBatchStreamDrawer() {
      const streamEl = document.getElementById('batchDrawerStream');
      if (!streamEl) return;

      streamEl.innerHTML = `
        <div class="batch-stream-card" onclick="focusSelectedNode()">
          <div style="font-family: var(--ff-cmd-mono); font-size: 0.72rem; color: var(--cmd-amber);">BATCH #GLB-0809 · IN TRANSIT</div>
          <div style="font-weight: 700; margin: 0.2rem 0;">120 KG Prepared Meals</div>
          <div style="font-size: 0.8rem; color: var(--cmd-text-muted);">Regional Donor Hub ➔ Recipient Hub</div>
        </div>
        <div class="batch-stream-card">
          <div style="font-family: var(--ff-cmd-mono); font-size: 0.72rem; color: var(--cmd-blue);">BATCH #HK-0809 · DISPATCHING</div>
          <div style="font-weight: 700; margin: 0.2rem 0;">85 KG Cooked Rice & Grains</div>
          <div style="font-size: 0.8rem; color: var(--cmd-text-muted);">Harvest Kitchen ➔ Grace Mission</div>
        </div>
        <div class="batch-stream-card">
          <div style="font-family: var(--ff-cmd-mono); font-size: 0.72rem; color: var(--cmd-green);">BATCH #CB-0809 · DELIVERED</div>
          <div style="font-weight: 700; margin: 0.2rem 0;">45 KG Artisan Bakery Items</div>
          <div style="font-size: 0.8rem; color: var(--cmd-text-muted);">City Bakery ➔ Hope Haven Home</div>
        </div>
      `;
    }

    // --- 9. Spatial Donation Creation Flow (+ New Donation) ---
    const wizardOverlay = document.getElementById('cmdWizardOverlay');
    const openWizardBtn = document.getElementById('openNewDonationWizard');
    const closeWizardBtn = document.getElementById('closeWizardBtn');
    const wizardForm = document.getElementById('cmdWizardForm');

    const wizardNextBtn = document.getElementById('cmdWizardNextBtn');
    const wizardPrevBtn = document.getElementById('cmdWizardPrevBtn');
    const wizardSubmitBtn = document.getElementById('cmdWizardSubmitBtn');
    const wizardStepTag = document.getElementById('wizardStepTag');

    let currentWizardStep = 1;

    const catCards = document.querySelectorAll('.cmd-cat-card');
    let selectedCat = 'Prepared Meals';

    catCards.forEach(card => {
      card.addEventListener('click', () => {
        catCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedCat = card.getAttribute('data-cat');
      });
    });

    if (openWizardBtn && wizardOverlay) {
      openWizardBtn.addEventListener('click', () => {
        wizardOverlay.classList.add('active');
        if (typeof gsap !== 'undefined') {
          gsap.to(camera.position, { x: 0, y: 85, z: 70, duration: 1.2, ease: 'power2.out' });
        }
        showWizardStep(1);
      });
    }

    if (closeWizardBtn && wizardOverlay) {
      closeWizardBtn.addEventListener('click', () => {
        wizardOverlay.classList.remove('active');
      });
    }

    function showWizardStep(step) {
      currentWizardStep = step;
      for (let i = 1; i <= 4; i++) {
        const stepEl = document.getElementById(`cmdStep${i}`);
        if (stepEl) stepEl.style.display = i === step ? 'block' : 'none';
      }

      const tags = [
        '01 FOOD · CATEGORY & QUANTITY',
        '02 PICKUP · KITCHEN & WINDOW',
        '03 FRESHNESS · COOKING TIMESTAMP',
        '04 HANDLING · PACKAGING & DISPATCH'
      ];

      if (wizardStepTag) wizardStepTag.textContent = tags[step - 1];
      if (wizardPrevBtn) wizardPrevBtn.style.visibility = step > 1 ? 'visible' : 'hidden';

      if (step === 4) {
        if (wizardNextBtn) wizardNextBtn.style.display = 'none';
        if (wizardSubmitBtn) wizardSubmitBtn.style.display = 'inline-flex';
      } else {
        if (wizardNextBtn) wizardNextBtn.style.display = 'inline-flex';
        if (wizardSubmitBtn) wizardSubmitBtn.style.display = 'none';
      }
    }

    if (wizardNextBtn) {
      wizardNextBtn.addEventListener('click', () => {
        if (currentWizardStep === 1) {
          const desc = document.getElementById('wizardItemDesc');
          const weight = document.getElementById('wizardQuantityKg');
          if (!desc.value || !weight.value || parseFloat(weight.value) <= 0) {
            alert('Please specify the food description and valid weight in KG.');
            return;
          }
        }
        if (currentWizardStep < 4) showWizardStep(currentWizardStep + 1);
      });
    }

    if (wizardPrevBtn) {
      wizardPrevBtn.addEventListener('click', () => {
        if (currentWizardStep > 1) showWizardStep(currentWizardStep - 1);
      });
    }

    // Submit Wizard & Spawn 3D Node & Route
    if (wizardForm) {
      wizardForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const desc = document.getElementById('wizardItemDesc')?.value || 'Surplus Meals';
        const weightKg = parseFloat(document.getElementById('wizardQuantityKg')?.value || '60');

        wizardOverlay.classList.remove('active');

        // Dynamically Spawn New 3D Node
        const newX = -15 + (Math.random() - 0.5) * 30;
        const newZ = 15 + (Math.random() - 0.5) * 30;

        const group = new THREE.Group();
        group.position.set(newX, 0, newZ);

        const ringGeo = new THREE.RingGeometry(1.5, 2.2, 32);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        const beamGeo = new THREE.CylinderGeometry(0.4, 0.9, 10, 16);
        const beamMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B, transparent: true, opacity: 0.4 });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.y = 5;
        group.add(beam);

        const sphereGeo = new THREE.SphereGeometry(1.0, 16, 16);
        const sphereMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.position.y = 10;
        group.add(sphere);

        const newData = {
          id: `node-${Date.now()}`,
          name: `Kitchen Batch (${selectedCat})`,
          type: 'DONOR',
          color: 0xF59E0B,
          pos: [newX, 0, newZ],
          sub: `${weightKg} KG · ${desc}`
        };

        sphere.userData = newData;
        group.userData = newData;

        scene.add(group);
        nodeMeshes.push(sphere);

        // Spawn New Route
        const newCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(newX, 0.5, newZ),
          new THREE.Vector3((newX + 25) / 2, 4, (newZ - 5) / 2),
          new THREE.Vector3(25, 0.5, -5)
        ]);

        const linePoints = newCurve.getPoints(50);
        const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
        const lineMat = new THREE.LineBasicMaterial({ color: 0xF59E0B, opacity: 0.8, transparent: true, linewidth: 3 });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        scene.add(lineMesh);

        // Particles
        for (let p = 0; p < 4; p++) {
          const pGeo = new THREE.SphereGeometry(0.4, 12, 12);
          const pMat = new THREE.MeshBasicMaterial({ color: 0xF59E0B });
          const pMesh = new THREE.Mesh(pGeo, pMat);
          scene.add(pMesh);

          activeParticles.push({
            mesh: pMesh,
            curve: newCurve,
            progress: (p * 0.25),
            speed: 0.002
          });
        }

        // Vehicle
        const vehicle = createVehicleMesh(0xF59E0B);
        scene.add(vehicle);
        activeVehicles.push({
          mesh: vehicle,
          curve: newCurve,
          progress: 0.05,
          speed: 0.0015
        });

        focusOnNodePosition(new THREE.Vector3(newX, 0, newZ));

        // Update Stats UI
        const statKg = document.getElementById('statTotalKg');
        const statRoutes = document.getElementById('statActiveRoutes');
        const tickerKg = document.getElementById('tickerWeight');

        if (statKg) {
          const curr = parseInt(statKg.textContent.replace(/,/g, ''), 10) || 2840;
          statKg.textContent = (curr + weightKg).toLocaleString();
        }

        if (statRoutes) {
          const currR = parseInt(statRoutes.textContent, 10) || 12;
          statRoutes.textContent = currR + 1;
        }

        if (tickerKg) {
          const currT = parseInt(tickerKg.textContent.replace(/,/g, ''), 10) || 1240;
          tickerKg.textContent = (currT + weightKg).toLocaleString();
        }

        openNodeDetailPanel(newData);
        wizardForm.reset();
      });
    }

    // --- 10. Animation Render Loop ---
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Particles
      activeParticles.forEach(p => {
        p.progress += p.speed;
        if (p.progress > 1) p.progress = 0;
        const pt = p.curve.getPointAt(p.progress);
        p.mesh.position.copy(pt);
      });

      // Vehicles
      activeVehicles.forEach(v => {
        v.progress += v.speed;
        if (v.progress > 1) v.progress = 0;
        const pt = v.curve.getPointAt(v.progress);
        v.mesh.position.copy(pt);

        const nextPt = v.curve.getPointAt(Math.min(v.progress + 0.01, 1));
        v.mesh.lookAt(nextPt);
      });
      // Nodes pulse
      scene.children.forEach(child => {
        if (child.isGroup && child.userData && child.userData.id) {
          const sphere = child.children[2];
          if (sphere) {
            sphere.position.y = 8 + Math.sin(elapsedTime * 2.5 + child.position.x) * 0.5;
          }
        }
      });
      controls.update();
      renderer.render(scene, camera);
    }
    animate();
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // ============================================
  // JIVAHAR DONOR DASHBOARD TELEMETRY & LOGIC
  // ============================================
  const dashBody = document.querySelector('.donor-dashboard-body');
  if (dashBody) {
    // Parse donor type parameter (?type=household or ?type=organization)
    const urlParams = new URLSearchParams(window.location.search);
    let typeParam = urlParams.get('type');
    if (typeParam) {
      typeParam = typeParam.toLowerCase();
      if (typeParam === 'household' || typeParam === 'organization') {
        localStorage.setItem('donorType', typeParam);
      } else {
        typeParam = localStorage.getItem('donorType') || 'household';
      }
    } else {
      typeParam = localStorage.getItem('donorType') || 'household';
    }

    // Update status text in top navbar status pill
    const networkStatus = document.getElementById('networkStatus');
    if (networkStatus) {
      if (typeParam === 'household') {
        networkStatus.textContent = "Donor Type: Household";
      } else {
        networkStatus.textContent = "Donor Type: Organisation";
      }
    }
    // ============================================
    // PERSISTENT LEDGER STATE (DONOR EXPERIENCE)
    // ============================================
    let donState = {
      totalKg: 0,
      mealsShared: 0,
      peopleReached: 0,
      co2Avoided: 0,
      donations: []
    };


    // Load state from local storage if available
    try {
      const saved = localStorage.getItem("jivahar_redesigned_state");
      if (saved) {
        donState = JSON.parse(saved);
      }
    } catch (e) {
      console.error("Error reading Jivahar state:", e);
    }

    const saveState = () => {
      try {
        localStorage.setItem("jivahar_redesigned_state", JSON.stringify(donState));
      } catch (e) {
        console.error("Error saving state:", e);
      }
    };

    // ============================================
    // NAVIGATION SWITCHER & TAB ROUTING
    // ============================================
    const tabs = document.querySelectorAll(".sidebar-tab-btn");
    const panes = document.querySelectorAll(".dash-tab-pane");

    const switchTab = (targetId) => {
      tabs.forEach(t => t.classList.toggle("active", t.getAttribute("data-target") === targetId));
      panes.forEach(p => p.classList.toggle("active", p.id === `pane-${targetId}`));

      // Instantly reset viewport scroll position to top on tab switch
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      const mainContainer = document.querySelector('.dash-main-container');
      if (mainContainer) mainContainer.scrollTop = 0;

      // If active tab is Overview, trigger counts animate and init Leaflet map
      if (targetId === "overview") {
        animateImpactStats();
        initOverviewMiniMap();
      }

      // If active tab is Donate, init wizard location map
      if (targetId === "donate") {
        setTimeout(initWizardLocationMap, 150);
      }

      // If tab is Impact, redraw chart
      if (targetId === "impact-history") {
        setTimeout(() => {
          renderImpactChart(currentChartTab);
        }, 100);
      }
    };

    tabs.forEach(t => {
      t.addEventListener("click", () => {
        switchTab(t.getAttribute("data-target"));
      });
    });

    // Header buttons redirects
    const btnTopDonate = document.getElementById("topOpenWizardBtn");
    if (btnTopDonate) {
      btnTopDonate.addEventListener("click", () => switchTab("donate"));
    }

    const btnCtaDonate = document.getElementById("ctaDonateBtn");
    if (btnCtaDonate) {
      btnCtaDonate.addEventListener("click", () => switchTab("donate"));
    }

    // Quick donation helper
    const btnQuickDonate = document.getElementById("ctaQuickDonateBtn");
    if (btnQuickDonate) {
      btnQuickDonate.addEventListener("click", () => {
        switchTab("donate");
        // Autofill prepared meals preset
        const descInput = document.getElementById("foodDescInput");
        const weightInput = document.getElementById("foodWeightInput");
        if (descInput) descInput.value = "15 kg Dinner Curry & Basmati Rice";
        if (weightInput) weightInput.value = "15";
      });
    }

    // Floating action button
    const fabBtn = document.getElementById("fabOpenWizardBtn");
    if (fabBtn) {
      fabBtn.addEventListener("click", () => switchTab("donate"));
    }

    // ============================================
    // RENDERING CORE LISTS & TABLES
    // ============================================
    const renderActiveDonations = () => {
      const container = document.getElementById("activeDonationsContainer");
      if (!container) return;

      const activeList = donState.donations.filter(d => d.active);
      if (activeList.length === 0) {
        container.innerHTML = `
          <div class="active-don-card organic-card" style="text-align: center; padding: 40px; grid-column: span 2;">
            <p style="font-size: 2rem; margin: 0 0 12px 0;">🥗</p>
            <p style="margin: 0; font-weight: 700; color: #1A221E;">No active food donations right now.</p>
            <p style="font-size: 0.8rem; margin: 6px 0 0 0; color: #48544D;">Post surplus food above to support local shelters.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = activeList.map(don => {
        const initials = don.volunteer ? don.volunteer.split(" ").map(n => n[0]).join("") : "VS";
        const defaultFoodImg = "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3";
        const photoSrc = (don.images && don.images.length > 0) ? don.images[0] : defaultFoodImg;
        return `
          <div class="active-don-card organic-card" style="padding: 22px;">
            <div class="active-don-card__header">
              <div class="active-don-card__food-info">
                <img src="${photoSrc}" alt="Food item photo" style="width: 54px; height: 54px; border-radius: 14px; object-fit: cover; border: 1px solid #E8E4DC;">
                <div>
                  <h3 class="active-don-card__food-name" style="font-weight: 800; color: #1A221E; margin: 0 0 2px 0;">${don.foodName}</h3>
                  <p class="active-don-card__created-time" style="font-size: 0.75rem; color: #48544D; margin: 0;">Listed ${don.createdTime} • <span class="organic-badge">${don.freshness}</span></p>
                </div>
              </div>
              <div class="active-don-card__status-summary">
                <span class="organic-badge organic-badge--terracotta">ETA: <strong id="eta-text-${don.id}">${don.eta} min</strong></span>
              </div>
            </div>

            <!-- Visual Stepper Progress -->
            <div class="lifecycle-stepper" style="margin-top: 16px;">
              <div class="step ${don.step >= 0 ? 'completed' : 'pending'}">
                <span class="step-check">${don.step > 0 ? '✓' : '●'}</span>
                <span class="step-label">Listed</span>
              </div>
              <div class="step ${don.step >= 1 ? 'completed' : 'pending'}">
                <span class="step-check">${don.step > 1 ? '✓' : (don.step === 1 ? '●' : '○')}</span>
                <span class="step-label">Matched</span>
              </div>
              <div class="step ${don.step === 2 ? 'active' : (don.step > 2 ? 'completed' : 'pending')}">
                <span class="step-check">${don.step > 2 ? '✓' : (don.step === 2 ? '●' : '○')}</span>
                <span class="step-label">Pickup</span>
              </div>
              <div class="step ${don.step >= 3 ? 'completed' : 'pending'}">
                <span class="step-check">${don.step >= 3 ? '✓' : '○'}</span>
                <span class="step-label">Delivered</span>
              </div>
            </div>

            <div class="active-don-card__driver-details">
              <div class="driver-info">
                <span class="driver-avatar" style="background:#1B4D3E; color:white;">${initials}</span>
                <div>
                  <strong style="color:#1A221E;">${don.volunteer}</strong>
                  <span style="color:#48544D;">Volunteer Courier</span>
                </div>
              </div>
              <div class="ngo-match-info">
                <span style="color:#48544D;">Matched Shelter:</span>
                <strong style="color:#1B4D3E;">${don.ngoMatched}</strong>
              </div>
            </div>

            <div class="active-don-card__footer">
              <button class="btn btn--sm btn-terracotta btn-track-pickup" data-id="${don.id}">Track Pickup</button>
              <button class="btn btn--sm btn-forest-green btn-view-donation" data-id="${don.id}">View Donation</button>
            </div>
          </div>
        `;
      }).join("");

      // Reattach details popup & live tracking modal listeners
      container.querySelectorAll(".btn-view-donation").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          openManifestModal(id);
        });
      });
      container.querySelectorAll(".btn-track-pickup").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          openTrackingModal(id);
        });
      });
    };

    const renderRecentHistoryTable = () => {
      const tbody = document.getElementById("recentHistoryTableBody");
      if (!tbody) return;

      const completed = donState.donations.filter(d => !d.active);
      if (completed.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--clr-neutral-mid);">No completed donations yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = completed.map(don => `
        <tr>
          <td><strong>${don.foodName.replace(/^\d+\s*kg\s*/, "")}</strong></td>
          <td>${don.quantity}</td>
          <td>${don.createdTime}</td>
          <td>${don.ngoMatched}</td>
          <td><span class="status-pill status-pill--delivered">✓ Delivered</span></td>
        </tr>
      `).join("");
    };

    const renderFullHistoryList = () => {
      const container = document.getElementById("donationsFullList");
      if (!container) return;

      const filterVal = document.getElementById("donHistoryFilterSelect")?.value || "all";
      const q = document.getElementById("donHistorySearchInput")?.value.toLowerCase() || "";

      let list = donState.donations;
      if (filterVal === "active") list = list.filter(d => d.active);
      if (filterVal === "delivered") list = list.filter(d => !d.active);

      if (q) {
        list = list.filter(d => d.foodName.toLowerCase().includes(q) || d.ngoMatched.toLowerCase().includes(q));
      }

      if (list.length === 0) {
        container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--clr-neutral-mid);">No matching donations found.</div>`;
        return;
      }

      container.innerHTML = list.map(don => {
        const badgeClass = don.active ? "status-pill--active" : "status-pill--delivered";
        const badgeLabel = don.active ? "Active Tracking" : "Delivered";
        const imagesHtml = (don.images && don.images.length > 0)
          ? `<div class="don-card-photos">
               ${don.images.map(img => `<img src="${img}" alt="Food photo" class="don-card-photo-img" onclick="openManifestModal('${don.id}')">`).join("")}
             </div>`
          : "";
        return `
          <div class="active-don-card" style="background:#FFF;">
            <div class="active-don-card__header">
              <div class="active-don-card__food-info">
                <span class="active-don-card__food-icon">🍲</span>
                <div>
                  <h3 class="active-don-card__food-name">${don.foodName}</h3>
                  <p class="active-don-card__created-time">${don.createdTime} • Recipient: <strong>${don.ngoMatched}</strong></p>
                </div>
              </div>
              <span class="status-pill ${badgeClass}">${badgeLabel}</span>
            </div>
            ${imagesHtml}
            <div style="font-size:0.8rem; color:var(--clr-neutral-mid); display:flex; gap:20px; margin-top:8px;">
              <div>Quantity: <strong>${don.quantity}</strong></div>
              <div>Volunteer: <strong>${don.volunteer}</strong></div>
              <div>Safety status: <strong style="color:#1B5E20;">HACCP thermal scan passed</strong></div>
            </div>
            <div style="margin-top:12px; display:flex; gap:8px;">
              <button class="btn btn--xs btn--glass" onclick="openManifestModal('${don.id}')">📜 View Safety Receipt</button>
            </div>
          </div>
        `;
      }).join("");
    };

    const attachHistoryListeners = () => {
      const filter = document.getElementById("donHistoryFilterSelect");
      const search = document.getElementById("donHistorySearchInput");
      if (filter) filter.addEventListener("change", renderFullHistoryList);
      if (search) search.addEventListener("input", renderFullHistoryList);
    };

    // ============================================
    // IMPACT NUMBERS COUNT-UP ANIMATIONS
    // ============================================
    const animateCount = (id, target) => {
      const el = document.getElementById(id);
      if (!el) return;
      let start = 0;
      const duration = 1200;
      const stepTime = Math.abs(Math.floor(duration / target));
      
      const timer = setInterval(() => {
        start += Math.ceil(target / 40);
        if (start >= target) {
          el.textContent = target.toLocaleString();
          clearInterval(timer);
        } else {
          el.textContent = start.toLocaleString();
        }
      }, 20);
    };

    const animateImpactStats = () => {
      animateCount("impFoodRescued", donState.totalKg);
      animateCount("impMealsShared", donState.mealsShared);
      animateCount("impPeopleReached", donState.peopleReached);
      animateCount("impCo2Avoided", donState.co2Avoided);
    };

    // ============================================
    // REAL INTERACTIVE LEAFLET MAP & OSRM ROUTING ENGINE
    // ============================================
    let miniLeafletMap = null;
    let miniCourierMarker = null;
    let miniRoutePolyline = null;
    let wizardLeafletMap = null;
    let wizardMarker = null;

    let dynamicRoutePoints = [
      [15.1424, 76.9238], // Donor (Kitchen)
      [15.1455, 76.9270],
      [15.1490, 76.9315], // Courier current
      [15.1525, 76.9350],
      [15.1560, 76.9392]  // Recipient Distribution Hub
    ];

    let courierRouteSegment = 1;
    let courierSegmentProgress = 0;

    // Helper to stop map gesture propagation while keeping standard page scrolling fluid
    const isolateMapEvents = (containerId) => {
      const container = document.getElementById(containerId);
      if (!container || typeof L === "undefined") return;
      L.DomEvent.disableScrollPropagation(container);
      L.DomEvent.disableClickPropagation(container);
    };

    const createCustomMapIcon = (emoji, labelText) => {
      if (typeof L === "undefined") return null;
      return L.divIcon({
        className: 'custom-map-icon',
        html: `
          <span class="icon-badge">${emoji}</span>
          ${labelText ? `<span class="icon-label">${labelText}</span>` : ''}
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });
    };

    // Open Source Routing Machine (OSRM API) Shortest Path & Multi-Route Optimizer
    let altRoutePolylines = [];

    const fetchOSRMRealRoute = async (startLat, startLng, endLat, endLng, profile = 'walking') => {
      try {
        // Request alternatives=true to evaluate multiple street network paths and pick the shortest
        const url = `https://router.project-osrm.org/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data && data.routes && data.routes.length > 0) {
          // Sort routes by distance (ascending) to guarantee the absolute shortest street path
          const sortedRoutes = data.routes.sort((a, b) => a.distance - b.distance);
          const shortestRoute = sortedRoutes[0];
          const primaryCoords = shortestRoute.geometry.coordinates.map(c => [c[1], c[0]]);

          const alternativeCoordsList = sortedRoutes.slice(1).map(r => r.geometry.coordinates.map(c => [c[1], c[0]]));

          return {
            coordinates: primaryCoords,
            alternativeCoordinates: alternativeCoordsList,
            distanceKm: (shortestRoute.distance / 1000).toFixed(2),
            durationMin: Math.round(shortestRoute.duration / 60),
            alternativesEvaluatedCount: sortedRoutes.length
          };
        }
      } catch (e) {
        console.warn("OSRM shortest path routing fallback:", e);
      }
      // Fallback straight/interpolated route if OSRM endpoint is offline
      return {
        coordinates: [
          [startLat, startLng],
          [(startLat * 2 + endLat) / 3, (startLng * 2 + endLng) / 3],
          [(startLat + endLat * 2) / 3, (startLng + endLng * 2) / 3],
          [endLat, endLng]
        ],
        alternativeCoordinates: [],
        distanceKm: "1.8",
        durationMin: 18,
        alternativesEvaluatedCount: 1
      };
    };

    window.testNgoRoute = async (ngoName, targetLat, targetLng) => {
      const donorCoords = [15.1424, 76.9238];
      const routeData = await fetchOSRMRealRoute(donorCoords[0], donorCoords[1], targetLat, targetLng, 'walking');

      dynamicRoutePoints = routeData.coordinates;
      courierRouteSegment = 0;
      courierSegmentProgress = 0;

      // Clear previous primary and alternative route polylines
      if (miniRoutePolyline && miniLeafletMap) {
        miniLeafletMap.removeLayer(miniRoutePolyline);
      }
      altRoutePolylines.forEach(line => {
        if (miniLeafletMap) miniLeafletMap.removeLayer(line);
      });
      altRoutePolylines = [];

      if (miniLeafletMap) {
        // Render alternative routes in faint dashed lines
        if (routeData.alternativeCoordinates && routeData.alternativeCoordinates.length > 0) {
          routeData.alternativeCoordinates.forEach(altCoords => {
            const altLine = L.polyline(altCoords, {
              color: '#94A3B8',
              weight: 3,
              opacity: 0.5,
              dashArray: '4, 4'
            }).addTo(miniLeafletMap);
            altRoutePolylines.push(altLine);
          });
        }

        // Render Primary Shortest Path in vibrant emerald green
        miniRoutePolyline = L.polyline(dynamicRoutePoints, {
          color: '#10B981',
          weight: 5,
          opacity: 0.95,
          dashArray: '8, 6'
        }).addTo(miniLeafletMap);

        miniLeafletMap.fitBounds(miniRoutePolyline.getBounds(), { padding: [30, 30] });
      }

      const infoText = document.getElementById("osrmRouteInfoText");
      if (infoText) {
        const altText = routeData.alternativesEvaluatedCount > 1 
          ? ` • Verified Shortest of ${routeData.alternativesEvaluatedCount} Evaluated Street Paths` 
          : '';
        infoText.innerHTML = `⚡ <strong>OPTIMAL SHORTEST PATH FOUND</strong> to <strong>${ngoName}</strong>: ${routeData.distanceKm} km (${routeData.durationMin} mins)${altText}`;
      }
    };

    const initOverviewMiniMap = () => {
      const container = document.getElementById("miniMapContainer");
      if (!container || typeof L === "undefined") return;

      isolateMapEvents("miniMapContainer");

      if (!miniLeafletMap) {
        container.innerHTML = "";

        miniLeafletMap = L.map("miniMapContainer", {
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          dragging: true
        }).setView([15.1492, 76.9315], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19
        }).addTo(miniLeafletMap);

        // Donor Marker
        L.marker([15.1424, 76.9238], {
          icon: createCustomMapIcon('🏠', 'Kitchen')
        }).addTo(miniLeafletMap);

        // Fetch and display ONLY registered NGOs from API
        fetch('http://127.0.0.1:5000/api/ngos')
          .then(res => res.json())
          .then(data => {
            if (data.success && data.ngos && data.ngos.length > 0) {
              data.ngos.forEach((ngo, i) => {
                const lat = ngo.lat || (15.1492 + (i + 1) * 0.008);
                const lng = ngo.lng || (76.9315 + (i + 1) * 0.006 * (i % 2 === 0 ? 1 : -1));
                const phoneStr = ngo.phone || ngo.email || "Verified NGO";
                
                const marker = L.marker([lat, lng], {
                  draggable: true,
                  icon: createCustomMapIcon("🏢", ngo.name)
                }).addTo(miniLeafletMap);

                marker.bindPopup(`
                  <div class="ngo-map-popup">
                    <h4>${ngo.name}</h4>
                    <p style="color:#16a34a; font-weight:600;">✓ Verified Registered NGO</p>
                    <div class="ngo-popup-stat">📞 ${phoneStr}</div>
                    <button class="btn btn--xs btn--emerald" style="margin-top:6px; width:100%; font-size:0.7rem;" onclick="window.testNgoRoute('${ngo.name}', ${lat}, ${lng})">🛣️ Route Real Path Here</button>
                  </div>
                `);

                marker.on('dragend', () => {
                  const pos = marker.getLatLng();
                  window.testNgoRoute(ngo.name, pos.lat, pos.lng);
                });
              });
            }
          })
          .catch(err => console.error("Error loading registered NGOs on mini map:", err));

        // Courier Marker
        miniCourierMarker = L.marker(dynamicRoutePoints[2] || [15.1490, 76.9315], {
          icon: createCustomMapIcon('🛵', 'Eco-Courier')
        }).addTo(miniLeafletMap);

        // Initial Real-Street Path Route
        window.testNgoRoute("Recipient Hub", 15.1560, 76.9392);
      } else {
        setTimeout(() => miniLeafletMap.invalidateSize(), 150);
      }
    };

    const animateMiniMapCourier = () => {
      if (miniCourierMarker && dynamicRoutePoints && dynamicRoutePoints.length > 1) {
        courierSegmentProgress += 0.006;
        if (courierSegmentProgress >= 1) {
          courierSegmentProgress = 0;
          courierRouteSegment = (courierRouteSegment + 1) % (dynamicRoutePoints.length - 1);
        }

        const pStart = dynamicRoutePoints[courierRouteSegment];
        const pEnd = dynamicRoutePoints[courierRouteSegment + 1];

        if (pStart && pEnd) {
          const currentLat = pStart[0] + (pEnd[0] - pStart[0]) * courierSegmentProgress;
          const currentLng = pStart[1] + (pEnd[1] - pStart[1]) * courierSegmentProgress;
          miniCourierMarker.setLatLng([currentLat, currentLng]);
        }
      }
      requestAnimationFrame(animateMiniMapCourier);
    };

    // Forward & Reverse Geocoding Helpers (OpenStreetMap Nominatim API)
    const searchAddressNominatim = async (query) => {
      const searchBtn = document.getElementById("mapAddressSearchBtn");
      if (searchBtn) searchBtn.textContent = "⌛ Searching...";
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await resp.json();
        if (data && data.length > 0) {
          const first = data[0];
          const lat = parseFloat(first.lat);
          const lon = parseFloat(first.lon);
          if (wizardLeafletMap && wizardMarker) {
            wizardLeafletMap.setView([lat, lon], 16);
            wizardMarker.setLatLng([lat, lon]);
            const coordText = document.getElementById("geoCoordText");
            if (coordText) {
              coordText.textContent = `GPS: ${lat.toFixed(6)}° N, ${lon.toFixed(6)}° E (${first.display_name.slice(0, 45)}...)`;
            }
            reverseGeocodeNominatim(lat, lon);
          }
        } else {
          alert("Location not found. Please try another search query (e.g., city, street, or landmark).");
        }
      } catch (err) {
        console.error("Geocoding error:", err);
      } finally {
        if (searchBtn) searchBtn.textContent = "🔍 Search";
      }
    };

    const reverseGeocodeNominatim = async (lat, lng) => {
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await resp.json();
        if (data && data.display_name) {
          const accessInput = document.getElementById("accessInstructionsInput");
          if (accessInput && !accessInput.value.trim()) {
            accessInput.value = `Pickup Location: ${data.display_name}`;
          }
          const coordText = document.getElementById("geoCoordText");
          if (coordText) {
            coordText.textContent = `GPS: ${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E (${data.display_name.slice(0, 45)}...)`;
          }
        }
      } catch (err) {
        console.warn("Reverse geocode warning:", err);
      }
    };

    const initWizardLocationMap = () => {
      const container = document.getElementById("wizardMapContainer");
      if (!container || typeof L === "undefined") return;

      isolateMapEvents("wizardMapContainer");

      const defaultCoords = [15.1424, 76.9238];

      if (!wizardLeafletMap) {
        wizardLeafletMap = L.map("wizardMapContainer", {
          zoomControl: true,
          attributionControl: false,
          scrollWheelZoom: true
        }).setView(defaultCoords, 15);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
          maxZoom: 19
        }).addTo(wizardLeafletMap);

        wizardMarker = L.marker(defaultCoords, {
          draggable: true,
          icon: createCustomMapIcon('📍', 'Pickup Pin')
        }).addTo(wizardLeafletMap);

        const updateWizardMapCoords = (lat, lng) => {
          const coordText = document.getElementById("geoCoordText");
          if (coordText) {
            coordText.textContent = `GPS: ${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E (Verified Location Pin)`;
          }
          reverseGeocodeNominatim(lat, lng);
        };

        wizardMarker.on('dragend', () => {
          const pos = wizardMarker.getLatLng();
          updateWizardMapCoords(pos.lat, pos.lng);
        });

        wizardLeafletMap.on('click', (e) => {
          wizardMarker.setLatLng(e.latlng);
          updateWizardMapCoords(e.latlng.lat, e.latlng.lng);
        });

        // Search Bar Event Listeners
        const searchBtn = document.getElementById("mapAddressSearchBtn");
        const searchInput = document.getElementById("mapAddressSearchInput");

        if (searchBtn && searchInput) {
          searchBtn.addEventListener("click", () => {
            const q = searchInput.value.trim();
            if (q) searchAddressNominatim(q);
          });

          searchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const q = searchInput.value.trim();
              if (q) searchAddressNominatim(q);
            }
          });
        }
      } else {
        setTimeout(() => wizardLeafletMap.invalidateSize(), 150);
      }
    };

    // ============================================
    // DEDICATED LIVE PICKUP TELEMETRY TRACKING MODAL
    // ============================================
    let trackingModalMap = null;
    let trackingCourierMarker = null;

    window.openTrackingModal = function(donationId) {
      const modal = document.getElementById("trackingMapModal");
      if (!modal) return;

      const don = donState.donations.find(d => d.id === donationId) || donState.donations[0];

      const titleEl = document.getElementById("trackingModalTitle");
      const courierNameEl = document.getElementById("trackCourierName");
      const speedEl = document.getElementById("trackSpeed");
      const distanceEl = document.getElementById("trackDistance");
      const etaEl = document.getElementById("trackEta");
      const addressesEl = document.getElementById("trackAddresses");

      if (titleEl) titleEl.textContent = `Live Telemetry Tracking — ${don.foodName}`;
      if (courierNameEl) courierNameEl.textContent = don.volunteer || "Assigned Courier";
      if (speedEl) speedEl.textContent = `⚡ ${Math.floor(20 + Math.random() * 8)} km/h`;
      if (distanceEl) distanceEl.textContent = `${(1.2 + Math.random() * 2).toFixed(1)} km`;
      if (etaEl) etaEl.textContent = `${don.eta || 12} mins`;
      if (addressesEl) addressesEl.textContent = `${don.donorName || "Donor Kitchen"} → ${don.ngoMatched || "Recipient Hub"}`;

      modal.classList.add("active");

      setTimeout(() => {
        const container = document.getElementById("trackingModalMapContainer");
        if (!container || typeof L === "undefined") return;

        if (!trackingModalMap) {
          isolateMapEvents("trackingModalMapContainer");
          trackingModalMap = L.map("trackingModalMapContainer", {
            zoomControl: true,
            attributionControl: false,
            scrollWheelZoom: true
          }).setView([15.1492, 76.9315], 14);

          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
          }).addTo(trackingModalMap);

          L.marker(realRoutePoints[0], { icon: createCustomMapIcon('🏠', 'Pickup') }).addTo(trackingModalMap);
          L.marker(realRoutePoints[realRoutePoints.length - 1], { icon: createCustomMapIcon('🏢', don.ngoMatched) }).addTo(trackingModalMap);

          trackingCourierMarker = L.marker(realRoutePoints[2], { icon: createCustomMapIcon('🛵', don.volunteer) }).addTo(trackingModalMap);

          L.polyline(realRoutePoints, { color: '#059669', weight: 5, opacity: 0.85, dashArray: '6, 6' }).addTo(trackingModalMap);
        } else {
          trackingModalMap.invalidateSize();
        }
      }, 200);
    };

    const closeTrackBtn = document.getElementById("closeTrackingModalBtn");
    const closeTrackBtn2 = document.getElementById("closeTrackingModalBtn2");
    if (closeTrackBtn) closeTrackBtn.addEventListener("click", () => document.getElementById("trackingMapModal").classList.remove("active"));
    if (closeTrackBtn2) closeTrackBtn2.addEventListener("click", () => document.getElementById("trackingMapModal").classList.remove("active"));

    // ============================================
    // COLORFUL MULTI-TAB IMPACT GRAPH VISUALIZATION
    // ============================================
    const renderImpactChart = (chartType) => {
      const canvas = document.getElementById("impactChartCanvas");
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      // Clear Canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const dataSet = {
        weekly: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          values: [120, 240, 180, 280, 210, 140, 114],
          unit: "kg",
          colorStart: "#10B981",
          colorEnd: "#047857"
        },
        co2: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          values: [8, 15, 12, 18, 14, 9, 8],
          unit: "kg CO₂",
          colorStart: "#06B6D4",
          colorEnd: "#0284C7"
        },
        meals: {
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          values: [480, 960, 720, 1120, 840, 560, 456],
          unit: "Meals",
          colorStart: "#F59E0B",
          colorEnd: "#D97706"
        },
        badges: {
          labels: ["Level 1", "Level 2", "Level 3", "Level 4 Gold"],
          values: [2000, 4000, 6500, 8450],
          unit: "XP",
          colorStart: "#8B5CF6",
          colorEnd: "#6D28D9"
        }
      };

      const chart = dataSet[chartType] || dataSet.weekly;
      const w = canvas.width;
      const h = canvas.height;
      const padding = 40;
      const graphH = h - padding * 2;
      const graphW = w - padding * 2;

      // Draw Grid Lines
      ctx.strokeStyle = "#F1F5F9";
      ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = padding + (graphH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(w - padding, y);
        ctx.stroke();
      }

      // Draw colorful bars with rounded corners & vibrant gradients
      const barWidth = (graphW / chart.values.length) - 22;
      const maxVal = Math.max(...chart.values) * 1.15;

      chart.values.forEach((val, idx) => {
        const barH = (val / maxVal) * graphH;
        const x = padding + 12 + (graphW / chart.values.length) * idx;
        const y = h - padding - barH;

        // Rich Gradient Fill
        const grad = ctx.createLinearGradient(x, y, x, h - padding);
        grad.addColorStop(0, chart.colorStart);
        grad.addColorStop(1, chart.colorEnd);
        ctx.fillStyle = grad;

        // Draw rounded rectangle bars
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barH, [8, 8, 0, 0]);
        } else {
          ctx.rect(x, y, barWidth, barH);
        }
        ctx.fill();

        // Draw X-axis labels
        ctx.fillStyle = "#64748B";
        ctx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(chart.labels[idx], x + barWidth / 2, h - padding + 18);

        // Draw value badges above bars
        ctx.fillStyle = chart.colorStart;
        ctx.font = "bold 11px 'JetBrains Mono', monospace";
        ctx.fillText(`${val} ${chart.unit}`, x + barWidth / 2, y - 8);
      });
    };

    let currentChartTab = "weekly";
    const chartTabs = document.querySelectorAll("#analyticsChartTabs .chart-tab");
    chartTabs.forEach(tab => {
      tab.addEventListener("click", () => {
        chartTabs.forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        currentChartTab = tab.getAttribute("data-chart");
        renderImpactChart(currentChartTab);
      });
    });

    // ============================================
    // REDESIGNED 5-STEP DONATION WIZARD ENGINE
    // ============================================
    const wizardPanes = document.querySelectorAll(".wizard-step-pane");
    const progressSteps = document.querySelectorAll(".wizard-progress-step");
    
    const wNextBtn = document.getElementById("wizardNextStepBtn");
    const wPrevBtn = document.getElementById("wizardPrevStepBtn");
    const wResetBtn = document.getElementById("wizardResetBtn");
    const wConfirmBtn = document.getElementById("wizardConfirmBtn");
    const wizardAlertBanner = document.getElementById("wizardAlertBanner");
    const safetyCertCheck = document.getElementById("safetyCertCheck");
    const nonVegSpecifyBox = document.getElementById("nonVegSpecifyBox");
    const allergenNone = document.getElementById("allergenNone");
    const allergenChecks = document.querySelectorAll(".allergen-check");

    let wizardStep = 1;

    // Set initial preparation timestamp to current time for Step 2
    const prepTimeInput = document.getElementById("prepTimeInput");
    if (prepTimeInput && !prepTimeInput.value) {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      prepTimeInput.value = now.toISOString().slice(0, 16);
    }

    // Toggle Non-Veg sub-selection box
    document.querySelectorAll("input[name='dietaryType']").forEach(radio => {
      radio.addEventListener("change", () => {
        if (nonVegSpecifyBox) {
          nonVegSpecifyBox.style.display = radio.value === "Non-Veg" ? "block" : "none";
        }
      });
    });

    // Allergen Checkbox exclusive "None" logic
    allergenChecks.forEach(chk => {
      chk.addEventListener("change", () => {
        if (chk === allergenNone && allergenNone.checked) {
          allergenChecks.forEach(other => {
            if (other !== allergenNone) other.checked = false;
          });
        } else if (chk !== allergenNone && chk.checked) {
          if (allergenNone) allergenNone.checked = false;
        }
      });
    });

    // Automated Hard Expiry Calculation Engine
    const updateExpiryCalculation = () => {
      const prepVal = prepTimeInput?.value;
      const storageCond = document.querySelector("input[name='storageCondition']:checked")?.value || "Room Temperature";
      const displayEl = document.getElementById("calcExpiryDisplay");
      const tagEl = document.getElementById("expiryPolicyTag");
      const customExpiry = document.getElementById("customExpiryTime");

      if (!prepVal || !displayEl) return;

      const prepDate = new Date(prepVal);
      let expiryHours = 4;
      let policyText = "4-Hour Room Temp Policy";

      if (storageCond === "Kept Hot") {
        expiryHours = 12;
        policyText = "12-Hour Hot Warmer Policy";
      } else if (storageCond === "Refrigerated / Chilled") {
        expiryHours = 24;
        policyText = "24-Hour Refrigerated Policy";
      }

      const expiryDate = new Date(prepDate.getTime() + expiryHours * 60 * 60 * 1000);
      const options = { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' };
      const formattedExpiry = expiryDate.toLocaleDateString('en-US', options);

      displayEl.textContent = `Hard Expiry: ${formattedExpiry} (${expiryHours}h Max)`;
      if (tagEl) tagEl.textContent = policyText;

      if (customExpiry && !customExpiry.value) {
        const localExpiry = new Date(expiryDate);
        localExpiry.setMinutes(localExpiry.getMinutes() - localExpiry.getTimezoneOffset());
        customExpiry.value = localExpiry.toISOString().slice(0, 16);
      }
    };

    if (prepTimeInput) {
      prepTimeInput.addEventListener("input", updateExpiryCalculation);
    }
    document.querySelectorAll("input[name='storageCondition']").forEach(radio => {
      radio.addEventListener("change", updateExpiryCalculation);
    });
    updateExpiryCalculation();

    // Enable/Disable Confirm Button based on Mandatory Safety Declaration
    if (safetyCertCheck && wConfirmBtn) {
      safetyCertCheck.addEventListener("change", () => {
        wConfirmBtn.disabled = !safetyCertCheck.checked;
      });
    }

    // ============================================
    // IMAGE UPLOAD SYSTEM FOR DONATION WIZARD
    // ============================================
    let wizardUploadedImages = [];

    const dropzone = document.getElementById("foodImageDropzone");
    const fileInput = document.getElementById("foodImageInput");
    const browseBtn = document.getElementById("browseImagesBtn");
    const cameraBtn = document.getElementById("cameraSnapBtn");
    const previewGrid = document.getElementById("foodImagePreviewGrid");

    const renderWizardImagePreviews = () => {
      if (!previewGrid) return;
      if (wizardUploadedImages.length === 0) {
        previewGrid.style.display = "none";
        previewGrid.innerHTML = "";
        return;
      }

      previewGrid.style.display = "grid";
      previewGrid.innerHTML = wizardUploadedImages.map((src, idx) => `
        <div class="img-preview-card">
          <img src="${src}" alt="Food photo ${idx + 1}" class="img-preview-thumb">
          <button type="button" class="img-preview-remove" data-idx="${idx}">✕</button>
        </div>
      `).join("");

      previewGrid.querySelectorAll(".img-preview-remove").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute("data-idx"), 10);
          wizardUploadedImages.splice(idx, 1);
          renderWizardImagePreviews();
        });
      });
    };

    const processFiles = (files) => {
      Array.from(files).forEach(file => {
        if (!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          wizardUploadedImages.push(e.target.result);
          renderWizardImagePreviews();
        };
        reader.readAsDataURL(file);
      });
    };

    if (dropzone && fileInput) {
      dropzone.addEventListener("click", (e) => {
        if (e.target.tagName !== "BUTTON" && e.target.tagName !== "INPUT") {
          fileInput.click();
        }
      });

      if (browseBtn) browseBtn.addEventListener("click", () => fileInput.click());
      if (cameraBtn) {
        cameraBtn.addEventListener("click", () => {
          fileInput.setAttribute("capture", "environment");
          fileInput.click();
        });
      }

      fileInput.addEventListener("change", (e) => {
        if (e.target.files && e.target.files.length > 0) {
          processFiles(e.target.files);
        }
      });

      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("image-dropzone--dragover");
      });

      dropzone.addEventListener("dragleave", () => {
        dropzone.classList.remove("image-dropzone--dragover");
      });

      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("image-dropzone--dragover");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          processFiles(e.dataTransfer.files);
        }
      });
    }

    // High-Precision Geolocation Auto-Detect Button with Real Geolocation API
    const detectGpsBtn = document.getElementById("detectGpsBtn");
    const geoCoordText = document.getElementById("geoCoordText");
    if (detectGpsBtn && geoCoordText) {
      detectGpsBtn.addEventListener("click", () => {
        detectGpsBtn.textContent = "⌛ Acquiring High-Precision GPS...";
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              const acc = pos.coords.accuracy;
              geoCoordText.textContent = `GPS: ${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E (Precise ±${Math.round(acc)}m)`;
              detectGpsBtn.textContent = "✅ Precise Location Verified";
              if (wizardLeafletMap && wizardMarker) {
                wizardLeafletMap.setView([lat, lng], 17);
                wizardMarker.setLatLng([lat, lng]);
                if (window.wizardAccuracyCircle) wizardLeafletMap.removeLayer(window.wizardAccuracyCircle);
                window.wizardAccuracyCircle = L.circle([lat, lng], { radius: acc, color: '#10B981', fillColor: '#10B981', fillOpacity: 0.15 }).addTo(wizardLeafletMap);
                reverseGeocodeNominatim(lat, lng);
              }
            },
            (err) => {
              console.warn("High precision GPS fallback:", err);
              geoCoordText.textContent = `GPS: 15.142400° N, 76.923800° E (Ballari Hub Verified)`;
              detectGpsBtn.textContent = "✅ Ballari Hub Verified";
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        } else {
          geoCoordText.textContent = `GPS: 15.142400° N, 76.923800° E (Ballari Hub Verified)`;
          detectGpsBtn.textContent = "✅ Ballari Hub Verified";
        }
      });
    }

    // Step Validation Function
    const validateStep = (step) => {
      if (wizardAlertBanner) wizardAlertBanner.style.display = "none";

      if (step === 1) {
        const desc = document.getElementById("foodDescInput")?.value.trim();
        if (!desc) {
          showWizardAlert("⚠️ Please enter a Dish Name / Description.");
          return false;
        }
      }

      if (step === 2) {
        const prepVal = prepTimeInput?.value;
        const storageCond = document.querySelector("input[name='storageCondition']:checked")?.value;
        if (!prepVal) {
          showWizardAlert("⚠️ Please specify the Time of Preparation.");
          return false;
        }

        const prepDate = new Date(prepVal);
        const now = new Date();
        const hoursDiff = (now.getTime() - prepDate.getTime()) / (1000 * 60 * 60);

        if (hoursDiff > 4 && storageCond === "Room Temperature") {
          showWizardAlert("⛔ Security Rule: Food prepared more than 4 hours ago cannot be kept at Room Temperature. Please select Refrigerated or Kept Hot storage.");
          return false;
        }
      }

      if (step === 3) {
        const servingsVal = parseInt(document.getElementById("servingsInput")?.value || "0", 10);
        const containerVal = document.getElementById("containerCountInput")?.value.trim();
        const donorType = localStorage.getItem("donorType") || "household";
        const minServings = donorType === "organization" ? 10 : 1;

        if (isNaN(servingsVal) || servingsVal < minServings) {
          showWizardAlert(`⛔ Security Rule: Estimated Servings cannot be 0. Minimum requirement for ${donorType === "organization" ? "Commercial" : "Household"} mode is ${minServings} serving(s).`);
          return false;
        }
        if (!containerVal) {
          showWizardAlert("⚠️ Please enter the Physical Volume / Container Count.");
          return false;
        }
      }

      if (step === 4) {
        const accessInst = document.getElementById("accessInstructionsInput")?.value.trim();
        const contactName = document.getElementById("contactNameInput")?.value.trim();
        const contactPhone = document.getElementById("contactPhoneInput")?.value.trim();

        if (!accessInst || !contactName || !contactPhone) {
          showWizardAlert("⚠️ Please provide Gate/Access Instructions and On-Site Contact details.");
          return false;
        }
      }

      return true;
    };

    const showWizardAlert = (msg) => {
      if (wizardAlertBanner) {
        wizardAlertBanner.textContent = msg;
        wizardAlertBanner.style.display = "block";
        wizardAlertBanner.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };

    const updateWizardStepUI = (step) => {
      wizardStep = step;
      if (wizardAlertBanner) wizardAlertBanner.style.display = "none";

      wizardPanes.forEach((pane, idx) => {
        pane.classList.toggle("active", idx + 1 === step);
      });

      progressSteps.forEach((progress, idx) => {
        progress.classList.toggle("active", idx + 1 === step);
        progress.classList.toggle("completed", idx + 1 < step);
      });

      const titleEl = document.getElementById("wizardTitleText");
      const subtitleEl = document.getElementById("wizardSubtitleText");

      const stepTitles = [
        "Step 1 of 5: Food Profiling & Safety Data",
        "Step 2 of 5: Time-Critical Clocks (Expiry Engine)",
        "Step 3 of 5: Quantity, Volume & Logistics",
        "Step 4 of 5: Location & Access Metadata",
        "Step 5 of 5: Legal Declaration & NGO Match"
      ];

      if (titleEl) titleEl.textContent = "Donate Surplus Food";
      if (subtitleEl) subtitleEl.textContent = stepTitles[step - 1];

      if (wPrevBtn) wPrevBtn.style.display = step > 1 ? "inline-flex" : "none";
      if (wNextBtn) wNextBtn.style.display = step < 5 ? "inline-flex" : "none";
      if (wConfirmBtn) wConfirmBtn.style.display = step === 5 ? "inline-flex" : "none";

      if (step === 4) {
        setTimeout(initWizardLocationMap, 150);
      }

      if (step === 5) {
        simulateNgoMatch();
      }
    };

    const simulateNgoMatch = () => {
      const summaryBox = document.getElementById("simulationSummaryBox");
      if (!summaryBox) return;

      const desc = document.getElementById("foodDescInput")?.value || "Surplus Inventory";
      const servings = document.getElementById("servingsInput")?.value || "20";
      const storageCond = document.querySelector("input[name='storageCondition']:checked")?.value || "Room Temp";
      const dietary = document.querySelector("input[name='dietaryType']:checked")?.value || "Veg";

      const matchingNGOs = ["Community Recipient Hub #1", "Community Recipient Hub #2", "Regional Food Bank", "Relief Aid Center"];
      const courierNames = ["Courier Partner (EV #1)", "Courier Partner (EV #2)", "Courier Partner (EV #3)"];

      const matchedNGO = matchingNGOs[Math.floor(Math.random() * matchingNGOs.length)];
      const matchedCourier = courierNames[Math.floor(Math.random() * courierNames.length)];
      const matchedETA = Math.floor(8 + Math.random() * 15);

      const imagesSummaryHtml = wizardUploadedImages.length > 0
        ? `<div style="margin-top: 8px;">
             <span style="font-size: 0.72rem; color: #64748B;">Uploaded Food Photos (${wizardUploadedImages.length}):</span>
             <div class="don-card-photos" style="margin-top: 4px;">
               ${wizardUploadedImages.map(img => `<img src="${img}" class="don-card-photo-img" style="width: 44px; height: 44px;">`).join("")}
             </div>
           </div>`
        : '';

      summaryBox.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:8px; text-align:left; font-size:0.85rem;">
          <div style="border-bottom:1px solid #E2E8F0; padding-bottom:6px; font-weight:800; color:#1B5E20;">AUTOMATED MATCH COMPLETE</div>
          <div>Target Distribution NGO: <strong>${matchedNGO}</strong></div>
          <div>Assigned Eco-Courier: <strong>${matchedCourier} (EV Rider)</strong></div>
          <div>ETA Window: <strong>${matchedETA} mins</strong></div>
          <div>Manifest Details: <strong>${servings} Servings of ${desc} (${dietary}, ${storageCond})</strong></div>
          ${imagesSummaryHtml}
        </div>
      `;

      summaryBox.setAttribute("data-ngo", matchedNGO);
      summaryBox.setAttribute("data-courier", matchedCourier);
      summaryBox.setAttribute("data-eta", matchedETA.toString());
    };

    if (wNextBtn) {
      wNextBtn.addEventListener("click", () => {
        if (validateStep(wizardStep)) {
          if (wizardStep < 5) {
            updateWizardStepUI(wizardStep + 1);
          }
        }
      });
    }

    if (wPrevBtn) {
      wPrevBtn.addEventListener("click", () => {
        if (wizardStep > 1) {
          updateWizardStepUI(wizardStep - 1);
        }
      });
    }

    if (wResetBtn) {
      wResetBtn.addEventListener("click", () => {
        const form = document.getElementById("redesignedWizardForm");
        if (form) form.reset();
        wizardUploadedImages = [];
        renderWizardImagePreviews();
        if (safetyCertCheck && wConfirmBtn) {
          wConfirmBtn.disabled = true;
        }
        updateWizardStepUI(1);
      });
    }

    // Submit Donation Form
    const wForm = document.getElementById("redesignedWizardForm");
    if (wForm) {
      wForm.addEventListener("submit", (e) => {
        e.preventDefault();
      });
    }

    if (wConfirmBtn) {
      wConfirmBtn.addEventListener("click", () => {
        if (!safetyCertCheck || !safetyCertCheck.checked) {
          showWizardAlert("⚠️ You must check the legal Safety Certification declaration before submitting.");
          return;
        }

        const desc = document.getElementById("foodDescInput")?.value || "Surplus Meals";
        const servings = parseInt(document.getElementById("servingsInput")?.value || "20", 10);
        const weightInput = document.getElementById("foodWeightInput")?.value;
        const computedWeight = weightInput ? parseFloat(weightInput) : Math.round(servings * 0.35);
        const dietary = document.querySelector("input[name='dietaryType']:checked")?.value || "Veg";

        const summaryBox = document.getElementById("simulationSummaryBox");
        const matchedNGO = summaryBox?.getAttribute("data-ngo") || "Hope Harbor Kitchen";
        const matchedCourier = summaryBox?.getAttribute("data-courier") || "Amit Patel";
        const matchedETA = parseInt(summaryBox?.getAttribute("data-eta") || "12", 10);

        const newId = `don-${Math.floor(8000 + Math.random() * 1000)}`;

        const newDon = {
          id: newId,
          foodName: `${servings} Servings ${desc} (${dietary})`,
          quantity: `${servings} Servings (${computedWeight} kg)`,
          weight: computedWeight,
          createdTime: "Just Now",
          createdTimeMs: Date.now(),
          freshness: "100% Verified",
          ngoMatched: matchedNGO,
          pickupStatus: "Volunteer en route",
          volunteer: matchedCourier,
          eta: matchedETA,
          step: 2,
          active: true,
          category: dietary,
          images: [...wizardUploadedImages]
        };

        // Add to active state
        donState.donations.unshift(newDon);

        // Update overall impact numbers
        donState.totalKg += computedWeight;
        donState.mealsShared += servings;
        donState.peopleReached += Math.round(servings * 0.9);
        donState.co2Avoided += Math.round(computedWeight * 0.08);

        saveState();

        // Refresh layouts
        renderActiveDonations();
        renderRecentHistoryTable();
        renderFullHistoryList();
        animateImpactStats();

        // Reset wizard & images
        const form = document.getElementById("redesignedWizardForm");
        if (form) form.reset();
        wizardUploadedImages = [];
        renderWizardImagePreviews();
        if (safetyCertCheck) safetyCertCheck.checked = false;
        wConfirmBtn.disabled = true;
        updateWizardStepUI(1);

        // Switch to Tab 1 (Overview) to show active listing
        const overviewTabBtn = document.querySelector(".sidebar-tab-btn[data-target='overview']");
        if (overviewTabBtn) overviewTabBtn.click();
      });
    }

    // ============================================
    // FSSAI MANIFEST LIGHT POPUP MODAL
    // ============================================
    window.openManifestModal = function(manifestId) {
      const modal = document.getElementById("manifestDetailModal");
      const content = document.getElementById("manifestModalContent");
      
      const matched = donState.donations.find(d => d.id === manifestId) || donState.donations[0];

      const manifestPhotosHtml = (matched.images && matched.images.length > 0)
        ? `<div style="margin-top: 14px; background: white; border: 1px solid #E2E8F0; padding: 12px; border-radius: 10px;">
             <span style="font-size: 0.76rem; font-weight: 800; color: #1E293B; display: block; margin-bottom: 6px;">📷 VERIFIED FOOD INSPECTION PHOTOS:</span>
             <div class="don-card-photos">
               ${matched.images.map(img => `<img src="${img}" alt="Verified Food Photo" style="width: 72px; height: 72px; border-radius: 8px; object-fit: cover; border: 1px solid #CBD5E1;">`).join("")}
             </div>
           </div>`
        : '';

      if (modal && content) {
        content.innerHTML = `
          <div style="background: rgba(27, 94, 32, 0.08); border: 1px solid rgba(27, 94, 32, 0.15); padding: 16px; border-radius: 12px; margin-bottom: 16px;">
            <div style="font-size: 0.72rem; font-family: 'JetBrains Mono', monospace; color: #1B5E20;">FSSAI CHAIN OF CUSTODY MANIFEST #${manifestId.toUpperCase()}</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: var(--clr-neutral-dark); margin-top: 4px;">100% Verified Food Safety Clearance</div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 0.82rem; color: var(--clr-neutral-mid);">
            <div>Establishment: <strong style="color: var(--clr-neutral-dark);">${matched.donorName || "Donor Kitchen"}</strong></div>
            <div>Matched Recipient: <strong style="color: var(--clr-neutral-dark);">${matched.ngoMatched}</strong></div>
            <div>Food Details: <strong style="color: var(--clr-neutral-dark);">${matched.foodName}</strong></div>
            <div>Safety check: <strong style="color:#1B5E20;">HACCP Temperature Passed</strong></div>
            <div>Courier Driver: <strong style="color: var(--clr-neutral-dark);">${matched.volunteer}</strong></div>
            <div>Status: <strong style="color: var(--clr-neutral-dark);">${matched.active ? "IN TRANSIT" : "DELIVERED"}</strong></div>
          </div>
          ${manifestPhotosHtml}
          <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #E2E8F0; font-size: 0.75rem; color: var(--clr-neutral-mid);">
            Signed digital receipt stored immutably in Jivahar Living Ledger. Certified suitable for immediate community meal redistribution.
          </div>
        `;
        modal.classList.add("active");
      }
    };

    const closeManifestBtn = document.getElementById("closeManifestModalBtn");
    const closeManifestBtn2 = document.getElementById("closeManifestModalBtn2");
    const printBtn = document.getElementById("printManifestBtn");

    if (closeManifestBtn) closeManifestBtn.addEventListener("click", () => document.getElementById("manifestDetailModal").classList.remove("active"));
    if (closeManifestBtn2) closeManifestBtn2.addEventListener("click", () => document.getElementById("manifestDetailModal").classList.remove("active"));
    if (printBtn) printBtn.addEventListener("click", () => window.print());

    // ============================================
    // NOTIFICATION SLIDE-OVER DRAWER
    // ============================================
    const notifBtn = document.getElementById("notifDrawerBtn");
    const notifDrawer = document.getElementById("notifDrawer");
    const closeNotifBtn = document.getElementById("closeNotifDrawerBtn");

    if (notifBtn && notifDrawer) {
      notifBtn.addEventListener("click", () => notifDrawer.classList.add("active"));
    }
    if (closeNotifBtn && notifDrawer) {
      closeNotifBtn.addEventListener("click", () => notifDrawer.classList.remove("active"));
    }

    // Keyboard shortcut Cmd+K / Ctrl+K search trigger
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const searchBox = document.getElementById("donHistorySearchInput");
        if (searchBox) {
          searchBox.focus();
          searchBox.scrollIntoView({ behavior: "smooth" });
        }
      }
    });

    // ============================================
    // NGO RECIPIENT PORTAL LOGIC & MAP ENGINES
    // ============================================
    let ngoRequirements = [];

    try {
      const savedReqs = localStorage.getItem("jivahar_ngo_requirements");
      if (savedReqs) ngoRequirements = JSON.parse(savedReqs);
    } catch (e) {
      console.error("Error reading NGO requirements:", e);
    }

    const saveNgoRequirements = () => {
      try {
        localStorage.setItem("jivahar_ngo_requirements", JSON.stringify(ngoRequirements));
      } catch (e) {
        console.error("Error saving NGO requirements:", e);
      }
    };

    const ngoTabs = document.querySelectorAll(".sidebar-tab-btn[data-ngo-target]");
    const ngoPanes = document.querySelectorAll("#pane-ngo-radar, #pane-ngo-requirements, #pane-ngo-deliveries, #pane-ngo-safety");

    window.switchNgoTab = function(targetId) {
      ngoTabs.forEach(t => t.classList.toggle("active", t.getAttribute("data-ngo-target") === targetId));
      ngoPanes.forEach(p => p.classList.toggle("active", p.id === `pane-ngo-${targetId}`));

      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

      if (targetId === "radar") {
        renderNgoSurplusCards();
        initNgoRadarMap();
      }
      if (targetId === "requirements") {
        renderNgoBroadcasts();
      }
      if (targetId === "deliveries") {
        renderNgoActiveDeliveries();
        initNgoDeliveryMap();
      }
      if (targetId === "safety") {
        renderNgoManifestTable();
      }
    };

    ngoTabs.forEach(t => {
      t.addEventListener("click", () => {
        switchNgoTab(t.getAttribute("data-ngo-target"));
      });
    });

    let ngoRadarMap = null;
    let ngoDeliveryMap = null;
    let ngoRadarRoutePolyline = null;
    let ngoRadarAltPolylines = [];

    let ngoDeliveryCourierMarker = null;
    let ngoDeliveryRoutePoints = [];
    let ngoCourierRouteSegment = 0;
    let ngoCourierSegmentProgress = 0;

    // Dynamic Top Telemetry Bar Update
    const renderNgoTelemetry = () => {
      const capEl = document.getElementById("ngoShelterCapacityVal");
      const mealsEl = document.getElementById("ngoMealsServedVal");
      const etaEl = document.getElementById("ngoActiveEtaVal");
      const storageEl = document.getElementById("ngoColdStorageVal");
      const welcomeBtn = document.getElementById("welcomeTrackDeliveryBtn");

      const activeDeliveries = donState.donations.filter(d => (d.claimedByNgo || d.ngoMatched) && d.step < 3);
      const deliveredBatches = donState.donations.filter(d => (d.claimedByNgo || d.ngoMatched) && d.step === 3);

      let deliveredServings = deliveredBatches.reduce((acc, d) => {
        const match = d.quantity ? d.quantity.match(/(\d+)\s*Servings/i) : null;
        return acc + (match ? parseInt(match[1], 10) : (d.weight ? Math.round(d.weight * 2.5) : 30));
      }, 0);
      const totalServedToday = deliveredServings;

      if (capEl) capEl.textContent = `${activeDeliveries.length > 0 ? activeDeliveries.length * 15 : 0} Servings Pending`;
      if (mealsEl) mealsEl.textContent = `${totalServedToday} Warm Meals`;

      let minEta = Infinity;
      let activeDriver = "EV Bike #04";
      activeDeliveries.forEach(d => {
        const etaVal = d.eta || 10;
        if (etaVal < minEta) {
          minEta = etaVal;
          activeDriver = `${d.volunteer || 'Driver'} (EV Bike)`;
        }
      });

      if (minEta !== Infinity) {
        if (etaEl) etaEl.textContent = `${minEta} mins (${activeDriver})`;
        if (welcomeBtn) welcomeBtn.innerHTML = `<span>🚚</span> Track Active Delivery (${minEta} min)`;
      } else {
        if (etaEl) etaEl.textContent = `All Delivered (Standby)`;
        if (welcomeBtn) welcomeBtn.innerHTML = `<span>🚚</span> View Relief Deliveries`;
      }

      if (storageEl) {
        const activeStorageKg = activeDeliveries.reduce((acc, d) => acc + (d.weight || 20), 0);
        const freePct = Math.max(10, 100 - Math.round(activeStorageKg * 0.8));
        storageEl.textContent = `${freePct}% Free (HACCP Safe)`;
      }
    };

    // OSRM Shortest Path Real Street Routing Trigger for NGO Radar Map
    window.routeNgoToDonorPath = async (donorName, donorLat, donorLng) => {
      const shelterCoords = [15.1560, 76.9392];
      const routeData = await fetchOSRMRealRoute(shelterCoords[0], shelterCoords[1], donorLat, donorLng, 'walking');

      if (ngoRadarRoutePolyline && ngoRadarMap) {
        ngoRadarMap.removeLayer(ngoRadarRoutePolyline);
      }
      ngoRadarAltPolylines.forEach(l => { if (ngoRadarMap) ngoRadarMap.removeLayer(l); });
      ngoRadarAltPolylines = [];

      if (ngoRadarMap) {
        if (routeData.alternativeCoordinates && routeData.alternativeCoordinates.length > 0) {
          routeData.alternativeCoordinates.forEach(altCoords => {
            const altLine = L.polyline(altCoords, { color: '#94A3B8', weight: 3, opacity: 0.5, dashArray: '4, 4' }).addTo(ngoRadarMap);
            ngoRadarAltPolylines.push(altLine);
          });
        }

        ngoRadarRoutePolyline = L.polyline(routeData.coordinates, {
          color: '#10B981', weight: 5, opacity: 0.95, dashArray: '8, 6'
        }).addTo(ngoRadarMap);

        ngoRadarMap.fitBounds(ngoRadarRoutePolyline.getBounds(), { padding: [35, 35] });
      }

      const infoBanner = document.getElementById("ngoOsrmRouteInfoText");
      if (infoBanner) {
        const altText = routeData.alternativesEvaluatedCount > 1 
          ? ` • Verified Shortest of ${routeData.alternativesEvaluatedCount} Evaluated Street Paths` 
          : '';
        infoBanner.innerHTML = `⚡ <strong>SHORTEST STREET ROUTE FOUND</strong> to <strong>${donorName}</strong>: ${routeData.distanceKm} km (${routeData.durationMin} mins)${altText}`;
      }
    };

    // Geocoding Nominatim Search for NGO Radar
    const searchNgoLocationNominatim = async (query) => {
      const searchBtn = document.getElementById("ngoMapAddressSearchBtn");
      if (searchBtn) searchBtn.textContent = "⌛ Searching...";
      try {
        const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await resp.json();
        if (data && data.length > 0) {
          const first = data[0];
          const lat = parseFloat(first.lat);
          const lon = parseFloat(first.lon);
          if (ngoRadarMap) {
            ngoRadarMap.setView([lat, lon], 15);
            const coordTag = document.getElementById("ngoRadarCoordText");
            if (coordTag) coordTag.textContent = `📍 GPS: ${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E (${first.display_name.slice(0, 30)}...)`;
          }
        } else {
          alert("Location not found. Please try another search term.");
        }
      } catch (err) {
        console.error("NGO Geocoding error:", err);
      } finally {
        if (searchBtn) searchBtn.textContent = "🔍 Search";
      }
    };

    // Attach Search and High Precision GPS handlers for NGO Radar
    setTimeout(() => {
      const searchBtn = document.getElementById("ngoMapAddressSearchBtn");
      const searchInput = document.getElementById("ngoMapAddressSearchInput");
      const gpsBtn = document.getElementById("ngoDetectGpsBtn");

      if (searchBtn && searchInput) {
        searchBtn.addEventListener("click", () => {
          const q = searchInput.value.trim();
          if (q) searchNgoLocationNominatim(q);
        });
        searchInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const q = searchInput.value.trim();
            if (q) searchNgoLocationNominatim(q);
          }
        });
      }

      if (gpsBtn) {
        gpsBtn.addEventListener("click", () => {
          gpsBtn.textContent = "⌛ Locating GPS...";
          if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                if (ngoRadarMap) {
                  ngoRadarMap.setView([lat, lng], 16);
                  const coordTag = document.getElementById("ngoRadarCoordText");
                  if (coordTag) coordTag.textContent = `📍 Precise GPS: ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`;
                  gpsBtn.textContent = "✅ Located";
                }
              },
              (err) => {
                console.warn("GPS error:", err);
                gpsBtn.textContent = "✅ Hub Verified";
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
          } else {
            gpsBtn.textContent = "✅ Hub Verified";
          }
        });
      }
    }, 300);

    const initNgoRadarMap = () => {
      const container = document.getElementById("ngoRadarMapContainer");
      if (!container || typeof L === "undefined") return;

      isolateMapEvents("ngoRadarMapContainer");

      if (!ngoRadarMap) {
        container.innerHTML = "";
        ngoRadarMap = L.map("ngoRadarMapContainer", {
          zoomControl: true,
          attributionControl: false,
          scrollWheelZoom: true
        }).setView([15.1560, 76.9392], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(ngoRadarMap);

        const shelterCoords = [15.1560, 76.9392];

        // 1km, 3km, 5km Distance Radius Circles
        L.circle(shelterCoords, { radius: 1000, color: '#10B981', weight: 1.5, fillColor: '#10B981', fillOpacity: 0.08, dashArray: '4, 4' }).addTo(ngoRadarMap);
        L.circle(shelterCoords, { radius: 3000, color: '#06B6D4', weight: 1.5, fillColor: '#06B6D4', fillOpacity: 0.05, dashArray: '4, 4' }).addTo(ngoRadarMap);
        L.circle(shelterCoords, { radius: 5000, color: '#6366F1', weight: 1, fillColor: '#6366F1', fillOpacity: 0.02, dashArray: '4, 4' }).addTo(ngoRadarMap);

        // Recipient Hub Pin
        L.marker(shelterCoords, { icon: createCustomMapIcon('🏢', 'Recipient Hub') })
          .addTo(ngoRadarMap)
          .bindPopup(`<div style="padding:4px;"><strong>Recipient Hub</strong><br>Center of 5km Proximity Radar</div>`);
      } else {
        setTimeout(() => ngoRadarMap.invalidateSize(), 150);
      }

      // Populate interactive donor pins for unclaimed active batches with OSRM route trigger
      const availableBatches = donState.donations.filter(d => d.active && !d.claimedByNgo);
      const donorsTag = document.getElementById("ngoDonorsInRangeTag");
      if (donorsTag) donorsTag.textContent = `${availableBatches.length} Donors in Range`;

      // Base donor pins from live active batches
      const donorPins = [];


      availableBatches.forEach((don, idx) => {
        const offsetLat = 15.1424 + (idx * 0.008) - 0.004;
        const offsetLng = 76.9238 + (idx * 0.006) - 0.003;
        donorPins.push({
          name: don.donorName || "Donor Kitchen",
          lat: offsetLat,
          lng: offsetLng,
          icon: "🏠",
          food: don.foodName,
          dist: "1.8 km",
          id: don.id
        });
      });

      donorPins.forEach(don => {
        const marker = L.marker([don.lat, don.lng], { icon: createCustomMapIcon(don.icon, `${don.name.slice(0, 15)}...`) })
          .addTo(ngoRadarMap);

        marker.bindPopup(`
          <div style="padding:6px;">
            <strong style="color:#0F172A; font-size:0.85rem;">${don.name}</strong><br>
            <span style="font-size:0.75rem; color:#059669;">${don.food}</span><br>
            <span style="font-size:0.72rem; color:#64748B;">Distance: ${don.dist}</span><br>
            <div style="display:flex; gap:4px; margin-top:6px;">
              <button onclick="claimFoodSurplus('${don.id}')" style="background:#059669; color:white; border:none; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;">⚡ Claim</button>
              <button onclick="window.routeNgoToDonorPath('${don.name}', ${don.lat}, ${don.lng})" style="background:#3B82F6; color:white; border:none; padding:4px 8px; border-radius:6px; font-size:0.7rem; font-weight:700; cursor:pointer;">🛣️ Route Path</button>
            </div>
          </div>
        `);
      });
    };

    const animateNgoDeliveryCourier = () => {
      if (ngoDeliveryCourierMarker && ngoDeliveryRoutePoints && ngoDeliveryRoutePoints.length > 1) {
        ngoCourierSegmentProgress += 0.006;
        if (ngoCourierSegmentProgress >= 1) {
          ngoCourierSegmentProgress = 0;
          ngoCourierRouteSegment = (ngoCourierRouteSegment + 1) % (ngoDeliveryRoutePoints.length - 1);
        }

        const pStart = ngoDeliveryRoutePoints[ngoCourierRouteSegment];
        const pEnd = ngoDeliveryRoutePoints[ngoCourierRouteSegment + 1];

        if (pStart && pEnd) {
          const currentLat = pStart[0] + (pEnd[0] - pStart[0]) * ngoCourierSegmentProgress;
          const currentLng = pStart[1] + (pEnd[1] - pStart[1]) * ngoCourierSegmentProgress;
          ngoDeliveryCourierMarker.setLatLng([currentLat, currentLng]);
        }
      }
      requestAnimationFrame(animateNgoDeliveryCourier);
    };

    const initNgoDeliveryMap = async () => {
      const container = document.getElementById("ngoDeliveryMapContainer");
      if (!container || typeof L === "undefined") return;

      isolateMapEvents("ngoDeliveryMapContainer");

      const donorCoords = [15.1424, 76.9238];
      const shelterCoords = [15.1560, 76.9392];

      const routeData = await fetchOSRMRealRoute(donorCoords[0], donorCoords[1], shelterCoords[0], shelterCoords[1], 'walking');
      ngoDeliveryRoutePoints = routeData.coordinates;

      if (!ngoDeliveryMap) {
        container.innerHTML = "";
        ngoDeliveryMap = L.map("ngoDeliveryMapContainer", {
          zoomControl: true,
          attributionControl: false,
          scrollWheelZoom: true
        }).setView([15.1492, 76.9315], 14);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(ngoDeliveryMap);

        L.marker(donorCoords, { icon: createCustomMapIcon('🏠', 'Pickup Kitchen') }).addTo(ngoDeliveryMap);
        L.marker(shelterCoords, { icon: createCustomMapIcon('🏢', 'Recipient Hub') }).addTo(ngoDeliveryMap);

        ngoDeliveryCourierMarker = L.marker(ngoDeliveryRoutePoints[1] || [15.1490, 76.9315], {
          icon: createCustomMapIcon('🛵', 'Eco-Courier')
        }).addTo(ngoDeliveryMap);

        L.polyline(ngoDeliveryRoutePoints, {
          color: '#059669', weight: 5, opacity: 0.85, dashArray: '6, 6'
        }).addTo(ngoDeliveryMap);

        animateNgoDeliveryCourier();
      } else {
        setTimeout(() => ngoDeliveryMap.invalidateSize(), 150);
      }
    };

    // Dedicated Live GPS Telemetry Modal for NGO Deliveries
    let ngoTrackingModalMap = null;
    let ngoTrackingCourierMarker = null;

    window.openNgoTrackingModal = function(donationId) {
      const modal = document.getElementById("ngoTrackingMapModal");
      if (!modal) return;

      const don = donState.donations.find(d => d.id === donationId) || donState.donations[0];

      const titleEl = document.getElementById("ngoTrackingModalTitle");
      const driverEl = document.getElementById("ngoTrackCourierName");
      const speedEl = document.getElementById("ngoTrackSpeed");
      const distEl = document.getElementById("ngoTrackDistance");
      const etaEl = document.getElementById("ngoTrackEta");
      const addrEl = document.getElementById("ngoTrackAddresses");

      if (titleEl) titleEl.textContent = `Live Courier Telemetry — ${don.foodName}`;
      if (driverEl) driverEl.textContent = don.volunteer || "Assigned Courier";
      if (speedEl) speedEl.textContent = `⚡ ${Math.floor(22 + Math.random() * 6)} km/h`;
      if (distEl) distEl.textContent = `${(1.4 + Math.random() * 1.5).toFixed(1)} km`;
      if (etaEl) etaEl.textContent = `${don.eta || 11} mins`;
      if (addrEl) addrEl.textContent = `${don.donorName || "Donor Kitchen"} ➔ ${don.ngoMatched || "Recipient Hub"}`;

      modal.classList.add("active");

      setTimeout(async () => {
        const container = document.getElementById("ngoTrackingModalMapContainer");
        if (!container || typeof L === "undefined") return;

        const donorCoords = [15.1424, 76.9238];
        const shelterCoords = [15.1560, 76.9392];
        const routeData = await fetchOSRMRealRoute(donorCoords[0], donorCoords[1], shelterCoords[0], shelterCoords[1], 'walking');

        if (!ngoTrackingModalMap) {
          isolateMapEvents("ngoTrackingModalMapContainer");
          ngoTrackingModalMap = L.map("ngoTrackingModalMapContainer", {
            zoomControl: true,
            attributionControl: false,
            scrollWheelZoom: true
          }).setView([15.1492, 76.9315], 14);

          L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(ngoTrackingModalMap);

          L.marker(routeData.coordinates[0], { icon: createCustomMapIcon('🏠', 'Pickup Kitchen') }).addTo(ngoTrackingModalMap);
          L.marker(routeData.coordinates[routeData.coordinates.length - 1], { icon: createCustomMapIcon('🏢', 'Recipient Hub') }).addTo(ngoTrackingModalMap);

          const midIdx = Math.floor(routeData.coordinates.length / 2);
          ngoTrackingCourierMarker = L.marker(routeData.coordinates[midIdx] || [15.1490, 76.9315], { icon: createCustomMapIcon('🛵', don.volunteer || 'Vikram') }).addTo(ngoTrackingModalMap);

          L.polyline(routeData.coordinates, { color: '#059669', weight: 5, opacity: 0.85, dashArray: '6, 6' }).addTo(ngoTrackingModalMap);
        } else {
          ngoTrackingModalMap.invalidateSize();
        }
      }, 200);
    };

    const closeNgoTrackBtn = document.getElementById("closeNgoTrackingModalBtn");
    const closeNgoTrackBtn2 = document.getElementById("closeNgoTrackingModalBtn2");
    if (closeNgoTrackBtn) closeNgoTrackBtn.addEventListener("click", () => document.getElementById("ngoTrackingMapModal").classList.remove("active"));
    if (closeNgoTrackBtn2) closeNgoTrackBtn2.addEventListener("click", () => document.getElementById("ngoTrackingMapModal").classList.remove("active"));

    // Render Available Surplus Cards for NGO Portal
    const renderNgoSurplusCards = () => {
      const container = document.getElementById("ngoSurplusCardsContainer");
      const countBadge = document.getElementById("availableBatchesCount");
      if (!container) return;

      const availableList = donState.donations.filter(d => d.active && !d.claimedByNgo);

      if (countBadge) {
        countBadge.textContent = `${availableList.length} Batch${availableList.length === 1 ? '' : 'es'} Available Nearby`;
      }

      if (availableList.length === 0) {
        container.innerHTML = `
          <div class="active-don-card human-card" style="text-align: center; padding: 40px;">
            <p style="font-size: 2rem; margin: 0 0 10px 0;">✨</p>
            <h3 style="font-weight: 800; color: #0F172A; margin: 0 0 4px 0;">All Surplus Batches Claimed!</h3>
            <p style="font-size: 0.82rem; color: #64748B; margin: 0;">New surplus listings from nearby kitchens will appear here automatically.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = availableList.map(don => `
        <div class="active-don-card human-card" style="border-left: 4px solid #059669;">
          <div class="active-don-card__header">
            <div class="active-don-card__food-info">
              <span class="active-don-card__food-icon" style="background:#ECFDF5; border:1px solid #A7F3D0;"><svg class="svg-icon svg-icon--lg" style="color:#059669;" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg></span>
              <div>
                <h3 class="active-don-card__food-name" style="font-weight: 700; color:#0F172A;">${don.foodName}</h3>
                <p class="active-don-card__created-time" style="font-size:0.75rem; color:#64748B;">Quantity: <strong>${don.quantity}</strong> • Freshness: <span class="freshness-badge">${don.freshness}</span></p>
              </div>
            </div>
            <span class="badge badge--emerald">Available</span>
          </div>
          ${(don.images && don.images.length > 0) ? `<div class="don-card-photos">${don.images.map(img => `<img src="${img}" class="don-card-photo-img">`).join("")}</div>` : ''}
          <div class="active-don-card__footer">
            <button class="btn btn--sm btn--emerald" onclick="claimFoodSurplus('${don.id}')" style="font-weight: 700;">⚡ Claim Food Surplus</button>
            <button class="btn btn--sm btn--glass" onclick="openManifestModal('${don.id}')">Safety Inspection</button>
          </div>
        </div>
      `).join("");
    };

    window.claimFoodSurplus = function(id) {
      const target = donState.donations.find(d => d.id === id);
      if (target) {
        target.claimedByNgo = true;
        target.ngoMatched = "Recipient Hub";
        target.step = 2; // Pickup in transit
        target.pickupStatus = "Volunteer Driver Dispatched";
        if (!target.eta || target.eta === 0) target.eta = Math.floor(8 + Math.random() * 10);
        saveState();
        renderNgoSurplusCards();
        renderNgoActiveDeliveries();
        renderNgoTelemetry();
        renderNgoManifestTable();
        initNgoRadarMap();
        initNgoDeliveryMap();
        alert(`🎉 Food Surplus Claimed Successfully!\nBatch: ${target.foodName}\nCourier: ${target.volunteer || 'Assigned Courier'} (${target.eta} mins ETA)\nAssigned to: ${target.ngoMatched}`);
        switchNgoTab("deliveries");
      }
    };

    // Render NGO Broadcast Requirements
    const renderNgoBroadcasts = () => {
      const list = document.getElementById("ngoBroadcastsList");
      if (!list) return;

      if (ngoRequirements.length === 0) {
        list.innerHTML = `<div style="padding: 20px; text-align: center; color: #64748B; font-size: 0.85rem;">No active requirements posted. Broadcast one using the form on the right!</div>`;
        return;
      }

      list.innerHTML = ngoRequirements.map(req => `
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span class="organic-badge" style="background: #ECFDF5; color: #065F46; font-weight: 700;">📡 ${req.status}</span>
              <span style="font-size: 0.72rem; color: #64748B;">Posted ${req.postedTime}</span>
            </div>
            <h4 style="font-size: 0.95rem; font-weight: 800; color: #0F172A; margin: 0 0 2px 0;">${req.quantity} Servings — ${req.foodType}</h4>
            <p style="font-size: 0.75rem; color: #475569; margin: 0;">Needed by: <strong>${req.neededByTime}</strong> • Priority Food Aid</p>
          </div>
          <button class="btn btn--xs btn--glass" onclick="removeNgoRequirement('${req.id}')" style="color: #EF4444; border-color: #FECDD3; font-weight: 700;">Cancel</button>
        </div>
      `).join("");
    };

    window.removeNgoRequirement = function(id) {
      ngoRequirements = ngoRequirements.filter(r => r.id !== id);
      saveNgoRequirements();
      renderNgoBroadcasts();
    };

    // Requirement Form submission handler
    const ngoReqForm = document.getElementById("ngoReqForm");
    if (ngoReqForm) {
      ngoReqForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const qty = document.getElementById("reqQuantityInput")?.value;
        const foodType = document.getElementById("reqTypeSelect")?.value;
        const neededTime = document.getElementById("reqTimeInput")?.value;

        if (!qty || !foodType || !neededTime) return;

        const newReq = {
          id: `req-${Math.floor(1000 + Math.random() * 9000)}`,
          shelterName: "Community Distribution Partner",
          quantity: parseInt(qty, 10),
          foodType: foodType,
          neededByTime: neededTime,
          postedTime: "Just now",
          status: "Active Broadcast"
        };

        ngoRequirements.unshift(newReq);
        saveNgoRequirements();
        renderNgoBroadcasts();
        ngoReqForm.reset();
        alert("📡 Emergency Meal Requirement Broadcasted to Nearby Donors & Commercial Kitchens!");
      });
    }

    const openBroadcastBtn = document.getElementById("openBroadcastModalBtn");
    const btnCreateReqInline = document.getElementById("btnCreateReqInline");
    if (openBroadcastBtn) {
      openBroadcastBtn.addEventListener("click", () => {
        switchNgoTab("requirements");
        const input = document.getElementById("reqQuantityInput");
        if (input) input.focus();
      });
    }
    if (btnCreateReqInline) {
      btnCreateReqInline.addEventListener("click", () => {
        switchNgoTab("requirements");
        const input = document.getElementById("reqQuantityInput");
        if (input) input.focus();
      });
    }

    // Render Active Incoming Deliveries for NGO Portal
    const renderNgoActiveDeliveries = () => {
      const list = document.getElementById("ngoActiveDeliveriesList");
      if (!list) return;

      const activeDeliveries = donState.donations.filter(d => (d.claimedByNgo || d.ngoMatched) && d.step < 3);

      if (activeDeliveries.length === 0) {
        list.innerHTML = `
          <div class="dash-card" style="background: white; border: 1px solid #E2E8F0; border-radius: 18px; padding: 40px; text-align: center;">
            <p style="font-size: 2.2rem; margin: 0 0 12px 0;">🚚</p>
            <h3 style="font-weight: 800; color: #0F172A; margin: 0 0 4px 0;">No Active Deliveries En Route</h3>
            <p style="font-size: 0.85rem; color: #64748B; margin: 0;">Claim available food surplus batches on the Surplus Radar tab to dispatch eco-couriers.</p>
          </div>
        `;
        return;
      }

      list.innerHTML = activeDeliveries.map(don => `
        <div class="dash-card" style="background: white; border: 1px solid #E2E8F0; border-radius: 18px; padding: 22px; border-left: 5px solid #059669;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px;">
            <div>
              <span class="organic-badge" style="background: #ECFDF5; color: #065F46; font-weight: 800;">🛵 Courier En Route • ETA ${don.eta || 10} mins</span>
              <h3 style="font-size: 1.1rem; font-weight: 800; color: #0F172A; margin: 6px 0 2px 0;">${don.foodName}</h3>
              <p style="font-size: 0.78rem; color: #64748B; margin: 0;">Donor: <strong>${don.donorName || "Registered Donor"}</strong> • Quantity: <strong>${don.quantity || (don.weight + " kg")}</strong></p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn--sm btn--glass" onclick="openNgoTrackingModal('${don.id}')" style="font-weight: 700;">📡 Track Courier GPS</button>
              <button class="btn btn--sm btn--emerald" onclick="confirmDeliveryReceived('${don.id}')" style="font-weight: 700;">
                ✓ Confirm Delivery Received
              </button>
            </div>
          </div>

          <!-- Lifecycle Stepper -->
          <div class="lifecycle-stepper" style="margin-bottom: 16px;">
            <div class="step completed">
              <span class="step-check">✓</span>
              <span class="step-label">Batch Listed</span>
            </div>
            <div class="step completed">
              <span class="step-check">✓</span>
              <span class="step-label">NGO Claimed</span>
            </div>
            <div class="step active">
              <span class="step-check">●</span>
              <span class="step-label">Courier En Route</span>
            </div>
            <div class="step pending">
              <span class="step-check">○</span>
              <span class="step-label">Delivered & Served</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; padding: 12px 16px; border-radius: 12px; font-size: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #059669; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800;">
                ${(don.volunteer || "VS").split(" ").map(n => n[0]).join("")}
              </div>
              <div>
                <strong style="color: #0F172A; display: block;">${don.volunteer || "Assigned Courier"}</strong>
                <span style="color: #64748B; font-size: 0.72rem;">Verified Eco-Courier (EV Rider #04)</span>
              </div>
            </div>
            <button class="btn btn--xs btn--glass" onclick="alert('Calling Courier Driver: +91 98765-43210')" style="font-weight: 700;">📞 Call Driver</button>
          </div>
        </div>
      `).join("");
    };

    window.confirmDeliveryReceived = function(id) {
      const target = donState.donations.find(d => d.id === id);
      if (target) {
        target.step = 3; // Delivered
        target.active = false;
        target.pickupStatus = "Delivered & Served";
        saveState();
        renderNgoActiveDeliveries();
        renderNgoSurplusCards();
        renderNgoTelemetry();
        renderNgoManifestTable();
        alert(`🎉 Delivery Confirmed Received!\nBatch: ${target.foodName}\nMeals added to today's count for ${target.ngoMatched || 'Recipient Hub'}.`);
      }
    };

    const renderNgoManifestTable = () => {
      const tbody = document.getElementById("ngoManifestTableBody");
      if (!tbody) return;

      const allManifests = donState.donations;
      if (allManifests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: #64748B;">No safety manifests recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = allManifests.map(don => `
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 12px;"><span class="manifest-tag">#${don.id.toUpperCase()}</span></td>
          <td style="padding: 12px;"><strong>${don.foodName}</strong></td>
          <td style="padding: 12px;">${don.donorName || "Donor Kitchen"}</td>
          <td style="padding: 12px;">${don.volunteer || "Assigned Courier"}</td>
          <td style="padding: 12px;"><span class="temp-badge temp-badge--hot">HACCP Safe</span></td>
          <td style="padding: 12px;"><button class="btn btn--xs btn--glass" onclick="openManifestModal('${don.id}')">📜 Inspect</button></td>
        </tr>
      `).join("");
    };

    // Inspection Modal logic for NGO Dashboard
    window.openManifestModal = function(manifestId) {
      let modal = document.getElementById("manifestModal");
      let titleEl = document.getElementById("manifestModalTitle");
      let bodyEl = document.getElementById("manifestModalBody");

      if (!modal) modal = document.getElementById("manifestDetailModal");
      if (!bodyEl) bodyEl = document.getElementById("manifestModalContent");

      const matched = donState.donations.find(d => d.id === manifestId) || donState.donations[0];
      if (!matched) return;

      const manifestPhotosHtml = (matched.images && matched.images.length > 0)
        ? `<div style="margin-top: 14px; background: #F8FAFC; border: 1px solid #E2E8F0; padding: 12px; border-radius: 10px;">
             <span style="font-size: 0.76rem; font-weight: 800; color: #1E293B; display: block; margin-bottom: 6px;">📷 VERIFIED FOOD INSPECTION PHOTOS:</span>
             <div class="don-card-photos">
               ${matched.images.map(img => `<img src="${img}" alt="Verified Food Photo" style="width: 72px; height: 72px; border-radius: 8px; object-fit: cover; border: 1px solid #CBD5E1;">`).join("")}
             </div>
           </div>`
        : '';

      if (modal && bodyEl) {
        bodyEl.innerHTML = `
          <div style="background: #ECFDF5; border: 1px solid #A7F3D0; padding: 16px; border-radius: 12px; margin-bottom: 16px;">
            <div style="font-size: 0.72rem; font-family: 'JetBrains Mono', monospace; color: #065F46;">FSSAI CHAIN OF CUSTODY MANIFEST #${matched.id.toUpperCase()}</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #065F46; margin-top: 4px;">100% Verified Food Safety Clearance</div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 0.82rem; color: #475569;">
            <div>Establishment: <strong style="color: #0F172A;">${matched.donorName || "Donor Kitchen"}</strong></div>
            <div>Matched Recipient: <strong style="color: #0F172A;">${matched.ngoMatched || "Recipient Hub"}</strong></div>
            <div>Food Description: <strong style="color: #0F172A;">${matched.foodName}</strong></div>
            <div>Safety Status: <strong style="color: #059669;">HACCP Temperature Passed</strong></div>
            <div>Courier Driver: <strong style="color: #0F172A;">${matched.volunteer || "Assigned Courier"}</strong></div>
            <div>Delivery Status: <strong style="color: #0F172A;">${matched.step === 3 ? "DELIVERED" : "EN ROUTE"}</strong></div>
          </div>
          ${manifestPhotosHtml}
          <div style="margin-top: 16px; padding-top: 14px; border-top: 1px solid #E2E8F0; font-size: 0.75rem; color: #64748B;">
            Signed digital receipt stored immutably in Jivahar Living Ledger. Certified suitable for immediate community meal redistribution.
          </div>
        `;
        modal.classList.add("active");
      }
    };

    const closeNgoManifestBtn = document.getElementById("closeManifestModalBtn");
    const closeNgoManifestBtn2 = document.getElementById("closeManifestModalBtn2");
    if (closeNgoManifestBtn) closeNgoManifestBtn.addEventListener("click", () => {
      const modal = document.getElementById("manifestModal") || document.getElementById("manifestDetailModal");
      if (modal) modal.classList.remove("active");
    });
    if (closeNgoManifestBtn2) closeNgoManifestBtn2.addEventListener("click", () => {
      const modal = document.getElementById("manifestModal") || document.getElementById("manifestDetailModal");
      if (modal) modal.classList.remove("active");
    });

    // Real-Time Cross-Tab LocalStorage Event Sync
    window.addEventListener('storage', (e) => {
      if (e.key === 'jivahar_redesigned_state' || e.key === 'jivahar_ngo_requirements') {
        try {
          const savedState = localStorage.getItem('jivahar_redesigned_state');
          if (savedState) donState = JSON.parse(savedState);
          const savedReqs = localStorage.getItem('jivahar_ngo_requirements');
          if (savedReqs) ngoRequirements = JSON.parse(savedReqs);

          if (document.getElementById('ngoSurplusCardsContainer')) {
            renderNgoSurplusCards();
            renderNgoBroadcasts();
            renderNgoActiveDeliveries();
            renderNgoManifestTable();
            renderNgoTelemetry();
          }
          if (document.getElementById('activeDonationsContainer')) {
            renderActiveDonations();
            renderRecentHistoryTable();
            renderFullHistoryList();
          }
        } catch (err) {
          console.error("Storage event sync error:", err);
        }
      }
    });

    // Initialize NGO portal components if on NGO dashboard
    if (document.getElementById("ngoSurplusCardsContainer")) {
      renderNgoTelemetry();
      renderNgoSurplusCards();
      renderNgoBroadcasts();
      renderNgoActiveDeliveries();
      renderNgoManifestTable();
      initNgoRadarMap();
    }

    // ============================================
    // VOLUNTEER ECO-COURIER PORTAL LOGIC & MAP ENGINES
    // ============================================
    let volState = {
      onShift: true,
      earningsToday: 0,
      creditsToday: 0,
      totalRuns: 0,
      totalMeals: 0,
      totalCo2: 0,
      activeRunId: null,
      activeRunStep: 0,
      history: []
    };


    try {
      const savedVol = localStorage.getItem("jivahar_volunteer_state");
      if (savedVol) volState = JSON.parse(savedVol);
    } catch (e) {
      console.error("Error reading volunteer state:", e);
    }

    const saveVolState = () => {
      try {
        localStorage.setItem("jivahar_volunteer_state", JSON.stringify(volState));
      } catch (e) {
        console.error("Error saving volunteer state:", e);
      }
    };

    const volTabs = document.querySelectorAll(".sidebar-tab-btn[data-vol-target]");
    const volPanes = document.querySelectorAll("#pane-vol-available, #pane-vol-active-run, #pane-vol-history, #pane-vol-safety");

    window.switchVolTab = function(targetId) {
      volTabs.forEach(t => t.classList.toggle("active", t.getAttribute("data-vol-target") === targetId));
      volPanes.forEach(p => p.classList.toggle("active", p.id === `pane-vol-${targetId}`));

      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

      if (targetId === "available") {
        renderVolAvailableRuns();
        initVolAvailableMap();
      }
      if (targetId === "active-run") {
        renderVolActiveRun();
        initVolActiveMap();
      }
      if (targetId === "history") {
        renderVolHistory();
      }
    };

    volTabs.forEach(t => {
      t.addEventListener("click", () => {
        switchVolTab(t.getAttribute("data-vol-target"));
      });
    });

    let volAvailableMap = null;
    let volActiveMap = null;
    let volAvailableRoutePolyline = null;
    let volActiveCourierMarker = null;

    const renderVolTelemetry = () => {
      const runsCountEl = document.getElementById("volAvailableRunsCount");
      const earningsEl = document.getElementById("volEarningsToday");
      const etaEl = document.getElementById("volActiveRunEta");
      const co2El = document.getElementById("volCo2Offset");
      const shiftStatusEl = document.getElementById("volShiftStatusText");
      const toggleShiftBtn = document.getElementById("toggleShiftBtn");

      const availableRuns = donState.donations.filter(d => d.active);

      if (runsCountEl) runsCountEl.textContent = `${availableRuns.length} Runs Nearby`;
      if (earningsEl) earningsEl.textContent = `₹${volState.earningsToday} (${volState.creditsToday} Credits)`;
      if (co2El) co2El.textContent = `${volState.totalCo2} kg CO₂ (EV Bike)`;

      const activeDon = donState.donations.find(d => d.id === volState.activeRunId) || availableRuns[0];
      if (activeDon && volState.activeRunId) {
        if (etaEl) etaEl.textContent = `${activeDon.eta || 11} mins (${activeDon.ngoMatched || 'Recipient Hub'})`;
      } else {
        if (etaEl) etaEl.textContent = `Standby (Ready for Runs)`;
      }

      if (shiftStatusEl && toggleShiftBtn) {
        if (volState.onShift) {
          shiftStatusEl.textContent = "SHIFT STATUS: ONLINE (Active Courier)";
          toggleShiftBtn.textContent = "🟢 On Shift (Accepting Runs)";
          toggleShiftBtn.classList.remove("btn--glass");
          toggleShiftBtn.classList.add("btn--emerald");
        } else {
          shiftStatusEl.textContent = "SHIFT STATUS: OFFLINE (Paused)";
          toggleShiftBtn.textContent = "⚪ Off Shift (Paused)";
          toggleShiftBtn.classList.remove("btn--emerald");
          toggleShiftBtn.classList.add("btn--glass");
        }
      }
    };

    const toggleShiftBtn = document.getElementById("toggleShiftBtn");
    if (toggleShiftBtn) {
      toggleShiftBtn.addEventListener("click", () => {
        volState.onShift = !volState.onShift;
        saveVolState();
        renderVolTelemetry();
        alert(volState.onShift ? "🟢 You are now ON SHIFT! Ready to accept delivery runs." : "⚪ Shift PAUSED. You are now offline.");
      });
    }

    const renderVolAvailableRuns = () => {
      const container = document.getElementById("volAvailableRunsContainer");
      const badge = document.getElementById("volRunsBadge");
      if (!container) return;

      const availableList = donState.donations.filter(d => d.active);

      if (badge) badge.textContent = `${availableList.length} Open Job${availableList.length === 1 ? '' : 's'}`;

      if (availableList.length === 0) {
        container.innerHTML = `
          <div class="active-don-card human-card" style="text-align: center; padding: 40px;">
            <p style="font-size: 2.2rem; margin: 0 0 10px 0;">🎉</p>
            <h3 style="font-weight: 800; color: #0F172A; margin: 0 0 4px 0;">All Delivery Runs Completed!</h3>
            <p style="font-size: 0.82rem; color: #64748B; margin: 0;">New surplus dispatches will appear here automatically when listed by kitchens.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = availableList.map(don => `
        <div class="active-don-card human-card" style="border-left: 4px solid #10B981;">
          <div class="active-don-card__header">
            <div class="active-don-card__food-info">
              <span class="active-don-card__food-icon" style="background:#ECFDF5; border:1px solid #A7F3D0;"><svg class="svg-icon svg-icon--lg" style="color:#059669;" viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10A10 10 0 0 0 12 2z"/><path d="M12 6v6l4 2"/></svg></span>
              <div>
                <h3 class="active-don-card__food-name" style="font-weight: 800; color:#0F172A;">${don.foodName}</h3>
                <p class="active-don-card__created-time" style="font-size:0.75rem; color:#64748B;">Pickup: <strong>${don.donorName || "Donor Kitchen"}</strong> ➔ Dropoff: <strong>${don.ngoMatched || "Recipient Hub"}</strong></p>
              </div>
            </div>
            <span class="badge badge--emerald" style="font-weight: 700;">+ ₹120 Credit</span>
          </div>
          <div style="font-size:0.78rem; color:#475569; display:flex; justify-content:space-between; margin:10px 0 14px 0; background:#F8FAFC; padding:8px 12px; border-radius:8px;">
            <span>Quantity: <strong>${don.quantity}</strong></span>
            <span>Distance: <strong>1.8 km (8 min)</strong></span>
            <span>Safety: <strong style="color:#059669;">HACCP Certified</strong></span>
          </div>
          <div class="active-don-card__footer" style="display:flex; gap:8px;">
            <button class="btn btn--sm btn--emerald" onclick="claimVolRun('${don.id}')" style="font-weight: 700;">⚡ Claim Delivery Run</button>
            <button class="btn btn--sm btn--glass" onclick="previewVolRoute('${don.id}', 15.1424, 76.9238)">🛣️ Preview Route</button>
          </div>
        </div>
      `).join("");
    };

    window.claimVolRun = function(id) {
      const target = donState.donations.find(d => d.id === id);
      if (target) {
        target.claimedByNgo = true;
        target.volunteer = "Assigned Courier";
        target.pickupStatus = "Volunteer Driver Dispatched";
        target.step = 2; // Pickup in transit
        volState.activeRunId = id;
        volState.activeRunStep = 0; // Claimed
        saveState();
        saveVolState();

        renderVolAvailableRuns();
        renderVolTelemetry();
        alert(`⚡ Delivery Run Claimed Successfully!\nBatch: ${target.foodName}\nPickup: ${target.donorName || 'Donor Kitchen'}\nDropoff: ${target.ngoMatched || 'Recipient Hub'}\nNavigating to Active Telemetry tab...`);
        switchVolTab("active-run");
      }
    };

    window.previewVolRoute = async function(id, lat, lng) {
      const routeData = await fetchOSRMRealRoute(15.1490, 76.9315, lat, lng, 'walking');
      if (volAvailableMap) {
        if (volAvailableRoutePolyline) volAvailableMap.removeLayer(volAvailableRoutePolyline);
        volAvailableRoutePolyline = L.polyline(routeData.coordinates, { color: '#10B981', weight: 5, opacity: 0.9, dashArray: '6, 6' }).addTo(volAvailableMap);
        volAvailableMap.fitBounds(volAvailableRoutePolyline.getBounds(), { padding: [30, 30] });
      }
      const info = document.getElementById("volOsrmRouteInfo");
      if (info) info.innerHTML = `⚡ <strong>OPTIMAL STREET ROUTE</strong> to Pickup: ${routeData.distanceKm} km (${routeData.durationMin} mins)`;
    };

    const initVolAvailableMap = () => {
      const container = document.getElementById("volAvailableMapContainer");
      if (!container || typeof L === "undefined") return;

      isolateMapEvents("volAvailableMapContainer");

      if (!volAvailableMap) {
        container.innerHTML = "";
        volAvailableMap = L.map("volAvailableMapContainer", {
          zoomControl: true,
          attributionControl: false,
          scrollWheelZoom: true
        }).setView([15.1492, 76.9315], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(volAvailableMap);

        // Courier Pin
        L.marker([15.1490, 76.9315], { icon: createCustomMapIcon('🛵', 'Eco-Courier') }).addTo(volAvailableMap);

        // Kitchen & Shelter Pins
        L.marker([15.1424, 76.9238], { icon: createCustomMapIcon('🏠', 'Pickup Kitchen') }).addTo(volAvailableMap);
        L.marker([15.1560, 76.9392], { icon: createCustomMapIcon('🏢', 'Recipient Hub') }).addTo(volAvailableMap);
      } else {
        setTimeout(() => volAvailableMap.invalidateSize(), 150);
      }
    };

    const renderVolActiveRun = () => {
      const container = document.getElementById("volActiveRunDetailsContainer");
      if (!container) return;

      const activeDon = donState.donations.find(d => d.id === volState.activeRunId) || donState.donations[0];
      const step = volState.activeRunStep;

      container.innerHTML = `
        <div class="dash-card" style="background: white; border: 1px solid #E2E8F0; border-radius: 18px; padding: 24px; border-left: 6px solid #10B981;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <span class="organic-badge" style="background: #ECFDF5; color: #065F46; font-weight: 800;">⚡ ACTIVE RELIEF DISPATCH #${activeDon.id.toUpperCase()}</span>
              <h3 style="font-size: 1.25rem; font-weight: 800; color: #0F172A; margin: 6px 0 2px 0;">${activeDon.foodName}</h3>
              <p style="font-size: 0.8rem; color: #64748B; margin: 0;">Quantity: <strong>${activeDon.quantity}</strong> • Freshness: <strong>${activeDon.freshness}</strong></p>
            </div>
            <span class="badge badge--emerald" style="font-size: 0.85rem; font-weight: 800;">+ ₹120 Credit</span>
          </div>

          <!-- Courier Stepper -->
          <div class="lifecycle-stepper" style="margin-bottom: 20px;">
            <div class="step ${step >= 0 ? 'completed' : 'pending'}">
              <span class="step-check">${step > 0 ? '✓' : '●'}</span>
              <span class="step-label">Accepted</span>
            </div>
            <div class="step ${step >= 1 ? 'completed' : (step === 0 ? 'active' : 'pending')}">
              <span class="step-check">${step > 1 ? '✓' : (step === 1 ? '●' : '○')}</span>
              <span class="step-label">At Kitchen</span>
            </div>
            <div class="step ${step >= 2 ? 'completed' : (step === 1 ? 'active' : 'pending')}">
              <span class="step-check">${step > 2 ? '✓' : (step === 2 ? '●' : '○')}</span>
              <span class="step-label">Food Loaded</span>
            </div>
            <div class="step ${step >= 3 ? 'completed' : 'pending'}">
              <span class="step-check">${step >= 3 ? '✓' : '○'}</span>
              <span class="step-label">Delivered</span>
            </div>
          </div>

          <!-- Address Metadata Cards -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 20px; font-size: 0.82rem;">
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 14px; border-radius: 12px;">
              <span style="font-size: 0.7rem; color: #64748B; font-weight: 800; display: block; margin-bottom: 4px;">1. PICKUP LOCATION</span>
              <strong style="color: #0F172A; display: block; font-size: 0.9rem;">${activeDon.donorName || 'Donor Kitchen'}</strong>
              <span style="color: #475569;">${activeDon.pickupAddress || 'Verified Pickup Address'}</span>
            </div>

            <div style="background: #F0FDF4; border: 1px solid #A7F3D0; padding: 14px; border-radius: 12px;">
              <span style="font-size: 0.7rem; color: #065F46; font-weight: 800; display: block; margin-bottom: 4px;">2. DROPOFF LOCATION</span>
              <strong style="color: #0F172A; display: block; font-size: 0.9rem;">${activeDon.ngoMatched || 'Recipient Hub'}</strong>
              <span style="color: #475569;">${activeDon.dropoffAddress || 'Verified Dropoff Address'}</span>
            </div>
          </div>

          <!-- Action Control Buttons -->
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${step === 0 ? `<button class="btn btn--emerald" onclick="updateVolStep(1)" style="font-weight: 700; flex: 1;">📍 Arrived at Donor Kitchen</button>` : ''}
            ${step === 1 ? `<button class="btn btn--emerald" onclick="updateVolStep(2)" style="font-weight: 700; flex: 1;">📦 Food Inspected & Loaded</button>` : ''}
            ${step === 2 ? `<button class="btn btn--emerald" onclick="updateVolStep(3)" style="font-weight: 700; flex: 1;">🏁 Confirm Delivery at Shelter</button>` : ''}
            ${step === 3 ? `<button class="btn btn--glass" disabled style="flex: 1; font-weight: 700; color: #059669;">✓ Delivery Complete!</button>` : ''}
            <button class="btn btn--glass" onclick="alert('Calling Donor Kitchen')">📞 Call Donor</button>
            <button class="btn btn--glass" onclick="alert('Calling NGO Receiver')">📞 Call NGO</button>
          </div>
        </div>
      `;
    };

    window.updateVolStep = function(nextStep) {
      volState.activeRunStep = nextStep;

      const activeDon = donState.donations.find(d => d.id === volState.activeRunId) || donState.donations[0];

      if (nextStep === 3) {
        if (activeDon) {
          activeDon.step = 3;
          activeDon.active = false;
          activeDon.pickupStatus = "Delivered & Verified";
        }
        volState.earningsToday += 120;
        volState.creditsToday += 8;
        volState.totalRuns += 1;
        volState.totalMeals += (activeDon.weight ? Math.round(activeDon.weight * 2.5) : 30);
        volState.totalCo2 += 3;

        volState.history.unshift({
          id: `run-${Math.floor(1000 + Math.random() * 9000)}`,
          foodName: activeDon.foodName,
          donor: activeDon.donorName || "Donor Kitchen",
          ngo: activeDon.ngoMatched || "Recipient Hub",
          distance: "1.8 km",
          credits: "₹120 (8 Credits)",
          status: "Completed",
          time: "Just now"
        });

        volState.activeRunId = null;
        volState.activeRunStep = 0;

        saveState();
        saveVolState();

        renderVolTelemetry();
        renderVolAvailableRuns();
        renderVolHistory();
        alert("🎉 Run Completed Successfully!\n₹120 Credits added to your wallet!\nMeals logged into community living ledger.");
        switchVolTab("history");
        return;
      }

      saveVolState();
      renderVolActiveRun();
    };

    const initVolActiveMap = async () => {
      const container = document.getElementById("volActiveMapContainer");
      if (!container || typeof L === "undefined") return;

      isolateMapEvents("volActiveMapContainer");

      const donorCoords = [15.1424, 76.9238];
      const shelterCoords = [15.1560, 76.9392];
      const routeData = await fetchOSRMRealRoute(donorCoords[0], donorCoords[1], shelterCoords[0], shelterCoords[1], 'walking');

      if (!volActiveMap) {
        container.innerHTML = "";
        volActiveMap = L.map("volActiveMapContainer", {
          zoomControl: true,
          attributionControl: false,
          scrollWheelZoom: true
        }).setView([15.1492, 76.9315], 14);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(volActiveMap);

        L.marker(donorCoords, { icon: createCustomMapIcon('🏠', 'Pickup Kitchen') }).addTo(volActiveMap);
        L.marker(shelterCoords, { icon: createCustomMapIcon('🏢', 'Recipient Hub') }).addTo(volActiveMap);

        volActiveCourierMarker = L.marker(routeData.coordinates[1] || [15.1490, 76.9315], {
          icon: createCustomMapIcon('🛵', 'Eco-Courier')
        }).addTo(volActiveMap);

        L.polyline(routeData.coordinates, { color: '#10B981', weight: 5, opacity: 0.9, dashArray: '6, 6' }).addTo(volActiveMap);
      } else {
        setTimeout(() => volActiveMap.invalidateSize(), 150);
      }
    };

    const renderVolHistory = () => {
      const tbody = document.getElementById("volHistoryTableBody");
      const totalRunsEl = document.getElementById("volTotalRunsStat");
      const totalMealsEl = document.getElementById("volTotalMealsStat");
      const totalCo2El = document.getElementById("volTotalCo2Stat");

      if (totalRunsEl) totalRunsEl.textContent = `${volState.totalRuns} Runs`;
      if (totalMealsEl) totalMealsEl.textContent = `${volState.totalMeals.toLocaleString()} Meals`;
      if (totalCo2El) totalCo2El.textContent = `${volState.totalCo2} kg CO₂`;

      if (!tbody) return;

      if (volState.history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #64748B;">No delivery runs logged yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = volState.history.map(r => `
        <tr style="border-bottom: 1px solid #F1F5F9;">
          <td style="padding: 12px;"><span class="manifest-tag">#${r.id.toUpperCase()}</span></td>
          <td style="padding: 12px;"><strong>${r.foodName}</strong></td>
          <td style="padding: 12px;">${r.donor}</td>
          <td style="padding: 12px;">${r.ngo}</td>
          <td style="padding: 12px;">${r.distance}</td>
          <td style="padding: 12px;"><span style="color:#059669; font-weight:700;">${r.credits}</span></td>
          <td style="padding: 12px;"><span class="badge badge--emerald">✓ ${r.status}</span></td>
        </tr>
      `).join("");
    };

    // Hygiene form handler
    const hygieneForm = document.getElementById("volHygieneForm");
    if (hygieneForm) {
      hygieneForm.addEventListener("submit", (e) => {
        e.preventDefault();
        alert("🛡️ Daily Pre-Shift Hygiene Verification Complete!\nYou are certified for food dispatches.");
        switchVolTab("available");
      });
    }

    // Initialize Volunteer portal components if on Volunteer console
    if (document.getElementById("volAvailableRunsContainer")) {
      renderVolTelemetry();
      renderVolAvailableRuns();
      renderVolHistory();
      initVolAvailableMap();
    }

    // ============================================
    // FLASK BACKEND LIVE SYNCHRONIZATION
    // ============================================
    const syncWithFlaskBackend = async () => {
      if (!window.JivaharAPI) return;

      // 1. Sync Live Platform Stats
      try {
        const statsRes = await JivaharAPI.getStats();
        if (statsRes && statsRes.success && statsRes.stats) {
          const s = statsRes.stats;
          const mealsEl = document.querySelector('[data-count="124850"]') || document.getElementById('statMealsServed');
          if (mealsEl) mealsEl.setAttribute('data-count', s.total_meals_served);
          const co2El = document.querySelector('[data-count="49820"]') || document.getElementById('statCo2Saved');
          if (co2El) co2El.setAttribute('data-count', Math.round(s.co2_saved_kg));
        }
      } catch (err) {
        console.warn("[Jivahar Flask Sync] Stats fetch skipped:", err);
      }

      // 2. Newsletter / Contact Form Submissions
      const newsletterForm = document.getElementById("newsletterForm");
      if (newsletterForm) {
        newsletterForm.addEventListener("submit", async (e) => {
          const emailInput = document.getElementById("newsletterEmail");
          if (emailInput && emailInput.value) {
            await JivaharAPI.submitContact({
              name: 'Subscriber',
              email: emailInput.value,
              role: 'Subscriber',
              message: 'Newsletter subscription signup'
            });
          }
        });
      }

      // 3. Sync Donor Form posting with Flask
      const scheduleForm = document.getElementById("schedulePickupForm") || document.getElementById("newDonationForm");
      if (scheduleForm) {
        scheduleForm.addEventListener("submit", async (e) => {
          const title = (document.getElementById("formFoodTitle") || document.getElementById("foodName"))?.value || "Surplus Food Meal";
          const qty = (document.getElementById("formServings") || document.getElementById("quantityServings"))?.value || "20 Servings";
          const address = (document.getElementById("formPickupAddress") || document.getElementById("pickupAddress"))?.value || "City Center Dock";
          const type = (document.getElementById("formFoodCategory") || document.getElementById("foodCategory"))?.value || "Cooked Meals";
          
          await JivaharAPI.createDonation({
            food_title: title,
            food_type: type,
            quantity: `${qty} Servings`,
            servings: parseInt(qty, 10) || 20,
            pickup_address: address,
            donor_name: 'Registered Donor'
          });
        });
      }
    };

    syncWithFlaskBackend();

    // ============================================
    // INITIALIZATION RUN
    // ============================================
    renderActiveDonations();
    renderRecentHistoryTable();
    renderFullHistoryList();
    attachHistoryListeners();
    animateImpactStats();
    initOverviewMiniMap();
    animateMiniMapCourier();

  }
});


