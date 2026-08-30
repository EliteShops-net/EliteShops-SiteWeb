/* ELITE SHOPS — interactions */
(function () {
  'use strict';

  /* ============================================================
     STORE CONFIG
     1. PRODUCTS: name + unit price per product key
     2. DISCORD_WEBHOOK_URL: paste the webhook URL of your server
        Orders are posted there with product, quantity & total.
     3. DISCORD_INVITE_URL: invite link customers use to join
        your Discord server after buying (delivery & follow-up).
     ============================================================ */
  var PRODUCTS = {
    elitecleaner: { name: 'EliteCleaner',              price: 9.99 },
    ekitemacro:   { name: 'elitemacro',                price: 9.99 },
    elitetweak:   { name: 'EliteTweak (FPS Booster)',  price: 9.99 }
  };
  /* Secure order relay - the Discord webhook is hidden in the Cloudflare
     Worker (worker.js). The site only talks to the Worker, so the webhook
     URL never appears in public code. */
  var DISCORD_WEBHOOK_URL = '';
  var DISCORD_INVITE_URL = 'https://discord.gg/p57ChfuEvF';
  var WORKER_URL = 'https://eliteshops-orders.adnanettouahri01-37d.workers.dev';
  var WORKER_SECRET = '2c401b8b460c0613cfddcc175c1434fde54120358d887b65';

  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.classList.toggle('open', open);
    });
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        navToggle.classList.remove('open');
      });
    });
  }

  var toast = document.getElementById('toast');
  var toastTimer = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 3200);
  }

  /* ============================================================
     ORDER MODAL (quantity + total + Discord order + join)
     ============================================================ */
  var modal = document.getElementById('checkoutModal');
  var modalTitle = document.getElementById('modalTitle');
  var modalUnit = document.getElementById('modalUnit');
  var modalTotal = document.getElementById('modalTotal');
  var qtyInput = document.getElementById('qtyInput');
  var qtyMinus = document.getElementById('qtyMinus');
  var qtyPlus = document.getElementById('qtyPlus');
  var modalUsername = document.getElementById('modalUsername');
  var modalBuy = document.getElementById('modalBuy');
  var modalBackdrop = document.getElementById('modalBackdrop');
  var modalClose = document.getElementById('modalClose');

  var currentProduct = null;

  function fmt(n) { return '$' + n.toFixed(2); }

  function updateTotal() {
    if (!currentProduct) return;
    var qty = Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1));
    qtyInput.value = qty;
    modalTotal.textContent = fmt(currentProduct.price * qty);
  }

  function openModal(key) {
    currentProduct = PRODUCTS[key];
    if (!currentProduct) return;
    modalTitle.textContent = currentProduct.name;
    modalUnit.textContent = fmt(currentProduct.price);
    qtyInput.value = 1;
    modalUsername.value = '';
    updateTotal();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  document.querySelectorAll('.buy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openModal(btn.getAttribute('data-checkout'));
    });
  });

  qtyMinus.addEventListener('click', function () {
    qtyInput.value = Math.max(1, parseInt(qtyInput.value, 10) - 1);
    updateTotal();
  });
  qtyPlus.addEventListener('click', function () {
    qtyInput.value = Math.min(99, parseInt(qtyInput.value, 10) + 1);
    updateTotal();
  });
  qtyInput.addEventListener('input', updateTotal);
  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  modalBuy.addEventListener('click', function () {
    if (!currentProduct) return;
    if (!WORKER_URL) {
      showToast('Order relay not configured - set WORKER_URL in js/main.js');
      return;
    }
    var qty = Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1));
    var username = (modalUsername.value || '').trim().replace(/^@/, '');
    if (!username) {
      showToast('Enter your Discord username to continue');
      return;
    }

    modalBuy.disabled = true;
    modalBuy.textContent = 'Sending...';

    fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + WORKER_SECRET
      },
      body: JSON.stringify({
        username: username,
        product: currentProduct.name,
        qty: qty,
        total: currentProduct.price * qty
      })
    }).then(function (res) {
      modalBuy.disabled = false;
      modalBuy.textContent = 'Pay';
      if (res.ok) {
        closeModal();
        showToast('Order sent! We will contact you on Discord.');
      } else {
        showToast('Delivery failed (HTTP ' + res.status + ') - try again');
      }
    }).catch(function () {
      modalBuy.disabled = false;
      modalBuy.textContent = 'Pay';
      showToast('Could not send the order - check your connection');
    });
  });

  /* ============================================================
     REVEAL + NAVBAR SHADOW
     ============================================================ */
  var revealEls = document.querySelectorAll('.product-card, .trust-card, .discord-inner, .hero-logo-wrap');
  revealEls.forEach(function (el) { el.classList.add('reveal'); });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('visible'); });
  }

  var navbar = document.getElementById('navbar');
  window.addEventListener('scroll', function () {
    if (navbar) {
      navbar.style.boxShadow = window.scrollY > 10 ? '0 10px 40px rgba(0,0,0,.45)' : 'none';
    }
  }, { passive: true });
})();