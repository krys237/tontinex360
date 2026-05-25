document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // STATE & INITIALIZATION
  // ==========================================================================
  let currentLang = localStorage.getItem('tontine_lang') || 'fr';
  let currentTheme = localStorage.getItem('tontine_theme') || 'light';

  initTheme();
  initLanguage();
  initMobileMenu();
  initScrollReveal();
  initSimulator();
  initPricingToggle();
  initContactForm();
  initNewsletterForm();

  // ==========================================================================
  // THEME (DARK / LIGHT) LOGIC
  // ==========================================================================
  function initTheme() {
    // Apply theme on load
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    updateThemeIcon();

    // Bind event
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', toggleTheme);
    }
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    localStorage.setItem('tontine_theme', currentTheme);
    
    if (currentTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const themeIcon = document.querySelector('#theme-toggle i');
    if (themeIcon) {
      if (currentTheme === 'dark') {
        // Moon to Sun icon replacement (using Inline SVG or font characters if needed, let's use SVG markup)
        themeIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0s-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-12.37c-.39-.39-1.02-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.38.39-1.02 0-1.41zm-12.37 12.37c-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06c.39-.38.39-1.02 0-1.41z"/></svg>`;
      } else {
        // Sun to Moon icon
        themeIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12.3 22h-.1c-5.5 0-10-4.5-10-10 0-4.8 3.5-8.9 8.2-9.8.6-.1 1.2.3 1.3.9.1.6-.3 1.2-.9 1.3-3.7.7-6.5 3.9-6.5 7.7 0 4.4 3.6 8 8 8 3.8 0 7-2.8 7.7-6.5.1-.6.7-1 1.3-.9.6.1 1 .7.9 1.3-.9 4.7-5 8.2-9.8 8.2z"/></svg>`;
      }
    }
  }

  // ==========================================================================
  // DYNAMIC LANGUAGE SWITCHER (i18n)
  // ==========================================================================
  function initLanguage() {
    const langSelect = document.getElementById('lang-select');
    if (langSelect) {
      langSelect.value = currentLang;
      langSelect.addEventListener('change', (e) => {
        setLanguage(e.target.value);
      });
    }
    
    // Sync UI lang text initially
    translateDOM();
  }

  function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('tontine_lang', currentLang);
    translateDOM();
    
    // Rerun simulator if present to translate terms and update formatting
    updateSimulatorResults();
  }

  function translateDOM() {
    document.documentElement.setAttribute('lang', currentLang);
    
    // Translate text elements
    const elements = document.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (translations[currentLang] && translations[currentLang][key]) {
        // If element is a link or standard text, we can update innerHTML to support highlighters (e.g. <span>)
        el.innerHTML = translations[currentLang][key];
      }
    });

    // Translate placeholder attributes
    const inputs = document.querySelectorAll('[data-i18n-placeholder]');
    inputs.forEach(input => {
      const key = input.getAttribute('data-i18n-placeholder');
      if (translations[currentLang] && translations[currentLang][key]) {
        input.setAttribute('placeholder', translations[currentLang][key]);
      }
    });
  }

  // Helper for formatting currencies
  function formatCurrency(amount) {
    return new Intl.NumberFormat(currentLang === 'fr' ? 'fr-FR' : 'en-US', {
      style: 'currency',
      currency: 'XOF',
      maximumFractionDigits: 0
    }).format(amount).replace('XOF', 'FCFA');
  }

  // ==========================================================================
  // MOBILE NAVIGATION
  // ==========================================================================
  function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    if (hamburger && navMenu) {
      hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('open');
        navMenu.classList.toggle('open');
      });

      // Close menu on link click
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          hamburger.classList.remove('open');
          navMenu.classList.remove('open');
        });
      });
    }
  }

  // ==========================================================================
  // INTERSECTION OBSERVER FOR SCROLL REVEAL
  // ==========================================================================
  function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            // Once revealed, no need to track it anymore
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
      });

      reveals.forEach(el => observer.observe(el));
    } else {
      // Fallback if observer is not supported
      reveals.forEach(el => el.classList.add('active'));
    }
  }

  // ==========================================================================
  // TONTINE SIMULATOR LOGIC
  // ==========================================================================
  let memberSlider, amountSlider, freqRadioWeekly, freqRadioMonthly;

  function initSimulator() {
    memberSlider = document.getElementById('sim-members');
    amountSlider = document.getElementById('sim-amount');
    freqRadioWeekly = document.getElementById('freq-weekly');
    freqRadioMonthly = document.getElementById('freq-monthly');

    if (memberSlider && amountSlider) {
      // Input listeners for real-time recalculations
      memberSlider.addEventListener('input', () => {
        document.getElementById('sim-members-val').textContent = memberSlider.value;
        updateSimulatorResults();
      });

      amountSlider.addEventListener('input', () => {
        // Value mapping for smoother slider steps
        const amount = getMappedAmountValue(amountSlider.value);
        document.getElementById('sim-amount-val').textContent = formatCurrency(amount);
        updateSimulatorResults();
      });

      if (freqRadioWeekly && freqRadioMonthly) {
        freqRadioWeekly.addEventListener('change', updateSimulatorResults);
        freqRadioMonthly.addEventListener('change', updateSimulatorResults);
      }

      // Initial run
      updateSimulatorResults();
    }
  }

  function getMappedAmountValue(step) {
    // Custom non-linear scale for standard contribution options
    // step ranges from 1 to 10
    const steps = {
      1: 2000,
      2: 5000,
      3: 10000,
      4: 20000,
      5: 30000,
      6: 50000,
      7: 75000,
      8: 100000,
      9: 250000,
      10: 500000
    };
    return steps[step] || 10000;
  }

  function updateSimulatorResults() {
    if (!memberSlider || !amountSlider) return;

    const members = parseInt(memberSlider.value);
    const amount = getMappedAmountValue(amountSlider.value);
    const isWeekly = freqRadioWeekly ? freqRadioWeekly.checked : false;

    // Calculations
    const totalPot = members * amount;
    const platformFee = totalPot * 0.005; // 0.5% fee
    const netPayout = totalPot - platformFee;
    
    // Duration text based on selected language
    let durationText = '';
    if (isWeekly) {
      const suffix = currentLang === 'fr' ? ' semaines' : ' weeks';
      durationText = members + suffix;
    } else {
      const suffix = currentLang === 'fr' ? ' mois' : ' months';
      durationText = members + suffix;
    }

    // Update result elements in DOM
    const totalEl = document.getElementById('sim-res-total-val');
    const durationEl = document.getElementById('sim-res-duration-val');
    const feeEl = document.getElementById('sim-res-fee-val');
    const payoutEl = document.getElementById('sim-res-payout-val');

    if (totalEl) totalEl.textContent = formatCurrency(totalPot);
    if (durationEl) durationEl.textContent = durationText;
    if (feeEl) feeEl.textContent = formatCurrency(platformFee);
    if (payoutEl) payoutEl.textContent = formatCurrency(netPayout);

    // Update inside Mockup screens dynamically if they are displayed
    updateMockupScreen(members, amount, totalPot);
  }

  function updateMockupScreen(members, amount, totalPot) {
    // If the page contains a mockup showing simulator outputs
    const mockupPot = document.getElementById('mockup-screen-pot');
    const mockupMembers = document.getElementById('mockup-screen-members');
    
    if (mockupPot) {
      mockupPot.textContent = formatCurrency(totalPot);
    }
    if (mockupMembers) {
      mockupMembers.textContent = members + (currentLang === 'fr' ? ' membres' : ' members');
    }
  }

  function initPricingToggle() {
    const monthlyBtn = document.getElementById('billing-monthly');
    const annualBtn = document.getElementById('billing-annual');
    const priceFamille = document.getElementById('price-famille');
    const priceVillage = document.getElementById('price-village');
    const priceQuartier = document.getElementById('price-quartier');
    const pricePro = document.getElementById('price-pro');
    const priceVip = document.getElementById('price-vip');
    const pricePresident = document.getElementById('price-president');

    if (monthlyBtn && annualBtn) {
      monthlyBtn.addEventListener('click', () => {
        monthlyBtn.classList.add('active');
        annualBtn.classList.remove('active');
        
        if (priceFamille) priceFamille.innerHTML = `3 000 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span>`;
        if (priceVillage) priceVillage.innerHTML = `4 000 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span>`;
        if (priceQuartier) priceQuartier.innerHTML = `7 500 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span>`;
        if (pricePro) pricePro.innerHTML = `25 000 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span>`;
        if (priceVip) priceVip.innerHTML = `50 000 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span>`;
        if (pricePresident) pricePresident.innerHTML = `75 000 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span>`;
      });

      annualBtn.addEventListener('click', () => {
        annualBtn.classList.add('active');
        monthlyBtn.classList.remove('active');
        
        const suffix = currentLang === 'fr' ? ' (facturé annuellement)' : ' (billed annually)';
        if (priceFamille) priceFamille.innerHTML = `2 400 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span> <span style="font-size: 0.8rem; opacity: 0.7; display: block;">${suffix}</span>`;
        if (priceVillage) priceVillage.innerHTML = `3 200 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span> <span style="font-size: 0.8rem; opacity: 0.7; display: block;">${suffix}</span>`;
        if (priceQuartier) priceQuartier.innerHTML = `6 000 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span> <span style="font-size: 0.8rem; opacity: 0.7; display: block;">${suffix}</span>`;
        if (pricePro) pricePro.innerHTML = `20 000 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span> <span style="font-size: 0.8rem; opacity: 0.7; display: block;">${suffix}</span>`;
        if (priceVip) priceVip.innerHTML = `40 000 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span> <span style="font-size: 0.8rem; opacity: 0.7; display: block;">${suffix}</span>`;
        if (pricePresident) pricePresident.innerHTML = `60 000 FCFA<span style="font-size: 1rem; font-weight: 500;">/mois</span> <span style="font-size: 0.8rem; opacity: 0.7; display: block;">${suffix}</span>`;
      });
    }
  }

  // ==========================================================================
  // FORMS HANDLING & MICRO-ANIMATIONS
  // ==========================================================================
  function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('form-name').value.trim();
        const email = document.getElementById('form-email').value.trim();
        const message = document.getElementById('form-message').value.trim();
        const successAlert = document.getElementById('form-success-alert');
        const errorAlert = document.getElementById('form-error-alert');

        // Simple validation
        if (name === '' || email === '' || message === '' || !validateEmail(email)) {
          showFormAlert(errorAlert, successAlert);
          return;
        }

        // Simulating submission animation
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="spinner">⌛</span> ...`;

        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          
          showFormAlert(successAlert, errorAlert);
          contactForm.reset();
        }, 1200);
      });
    }
  }

  function initNewsletterForm() {
    const newsForm = document.getElementById('newsletter-form');
    if (newsForm) {
      newsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const emailInput = newsForm.querySelector('.newsletter-input');
        const email = emailInput.value.trim();

        if (email === '' || !validateEmail(email)) {
          emailInput.style.borderColor = 'var(--error)';
          setTimeout(() => {
            emailInput.style.borderColor = 'rgba(255,255,255,0.2)';
          }, 2000);
          return;
        }

        const originalText = newsForm.querySelector('.btn').innerHTML;
        const btn = newsForm.querySelector('.btn');
        btn.disabled = true;
        btn.innerHTML = '✓';

        setTimeout(() => {
          emailInput.value = '';
          btn.disabled = false;
          btn.innerHTML = originalText;
          alert(currentLang === 'fr' ? 'Merci de votre inscription !' : 'Thank you for subscribing!');
        }, 1000);
      });
    }
  }

  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function showFormAlert(toShow, toHide) {
    if (toHide) toHide.style.display = 'none';
    if (toShow) {
      toShow.style.display = 'block';
      toShow.style.animation = 'slideDown 0.4s ease forwards';
    }
  }
});
