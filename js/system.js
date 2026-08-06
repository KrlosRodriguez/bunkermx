/* ============================================================
   BUNKER SYSTEM V2.0 — Core JS
   Cursor, Nav, Typing, Counters, Glitch, Reveal, Transitions
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── CUSTOM CURSOR (crosshair) ──
  const cur = document.getElementById('cur');
  const curR = document.getElementById('curR');
  if (cur && curR) {
    let mx = 0, my = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', e => {
      mx = e.clientX; my = e.clientY;
      cur.style.left = mx + 'px';
      cur.style.top = my + 'px';
    });
    (function loop() {
      rx += (mx - rx) * .1;
      ry += (my - ry) * .1;
      curR.style.left = rx + 'px';
      curR.style.top = ry + 'px';
      requestAnimationFrame(loop);
    })();

    // Hover states
    const hoverEls = 'a,button,.hud-panel,.hud-btn,.nav-link,.mob-link,.proj-row,.team-card,.svc-panel';
    document.querySelectorAll(hoverEls).forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cur-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cur-hover'));
    });
  }

  // ── NAVIGATION ──
  const ham = document.getElementById('ham');
  const mob = document.getElementById('mob');
  if (ham && mob) {
    const closeDrawer = () => {
      ham.classList.remove('open');
      mob.classList.remove('open');
      ham.focus();
    };
    const openDrawer = () => {
      ham.classList.add('open');
      mob.classList.add('open');
      const firstLink = mob.querySelector('.mob-link');
      if (firstLink) firstLink.focus();
    };

    ham.addEventListener('click', () => {
      mob.classList.contains('open') ? closeDrawer() : openDrawer();
    });

    // Close on outside click
    document.addEventListener('click', e => {
      if (!ham.contains(e.target) && !mob.contains(e.target)) {
        ham.classList.remove('open');
        mob.classList.remove('open');
      }
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mob.classList.contains('open')) {
        closeDrawer();
      }
    });

    // Focus trap inside drawer
    mob.addEventListener('keydown', e => {
      if (e.key !== 'Tab' || !mob.classList.contains('open')) return;
      const focusable = mob.querySelectorAll('a, button');
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  // Active nav link based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .mob-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === 'index.html' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // Scroll spy for index.html sections
  if (currentPage === 'index.html' || currentPage === '' || currentPage === '/') {
    const sections = document.querySelectorAll('section[id]');
    if (sections.length > 0) {
      const spyObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            const id = e.target.id;
            document.querySelectorAll('.nav-link').forEach(l => {
              l.classList.toggle('active', l.getAttribute('href') === '#' + id);
            });
          }
        });
      }, { threshold: .2, rootMargin: '-60px 0px -40% 0px' });
      sections.forEach(s => spyObs.observe(s));
    }
  }

  // ── SCROLL REVEAL ──
  const revObs = new IntersectionObserver(entries => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('vis'), i * 50);
        revObs.unobserve(e.target);
      }
    });
  }, { threshold: .06, rootMargin: '0px 0px -30px 0px' });
  document.querySelectorAll('.rev').forEach(el => revObs.observe(el));
  // Fallback
  setTimeout(() => document.querySelectorAll('.rev:not(.vis)').forEach(el => el.classList.add('vis')), 4000);

  // ── TYPING EFFECT ──
  window.typeText = function(el, text, speed = 40, callback) {
    el.textContent = '';
    let i = 0;
    const interval = setInterval(() => {
      el.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        if (callback) callback();
      }
    }, speed);
    return interval;
  };

  // Auto-type elements with data-type attribute
  document.querySelectorAll('[data-type]').forEach(el => {
    const text = el.dataset.type;
    const speed = parseInt(el.dataset.typeSpeed) || 35;
    const delay = parseInt(el.dataset.typeDelay) || 0;
    el.textContent = '';

    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          setTimeout(() => {
            typeText(el, text, speed);
          }, delay);
          obs.unobserve(el);
        }
      });
    }, { threshold: .3 });
    obs.observe(el);
  });

  // ── COUNTER ANIMATION ──
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = el.dataset.count;
    const suffix = el.dataset.countSuffix || '';
    const prefix = el.dataset.countPrefix || '';
    const duration = parseInt(el.dataset.countDuration) || 1500;

    // Parse numeric value
    const numericStr = target.replace(/[^0-9.]/g, '');
    const numericVal = parseFloat(numericStr);

    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          animateCounter(el, numericVal, duration, prefix, suffix);
          obs.unobserve(el);
        }
      });
    }, { threshold: .3 });
    obs.observe(el);
  });

  function animateCounter(el, target, duration, prefix, suffix) {
    const start = performance.now();
    const isFloat = target % 1 !== 0;

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      el.textContent = prefix + (isFloat ? (eased * target).toFixed(1) : current) + suffix;

      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  // ── BOOT SEQUENCE ──
  const bootEl = document.getElementById('boot-sequence');
  if (bootEl) {
    const lines = bootEl.querySelectorAll('.boot-line');
    let delay = 100;
    let bootSkipped = false;
    const bootTimers = [];

    const skipBoot = () => {
      if (bootSkipped) return;
      bootSkipped = true;
      bootTimers.forEach(t => clearTimeout(t));
      lines.forEach(line => {
        const text = line.dataset.text || line.textContent;
        line.textContent = text;
        line.style.opacity = '1';
        line.classList.add('boot-done');
      });
      bootEl.classList.add('boot-complete');
      document.getElementById('main-content')?.classList.add('loaded');
      document.removeEventListener('click', skipBoot);
      document.removeEventListener('keydown', skipBoot);
      document.removeEventListener('touchstart', skipBoot);
    };

    document.addEventListener('click', skipBoot, { once: true });
    document.addEventListener('keydown', skipBoot, { once: true });
    document.addEventListener('touchstart', skipBoot, { once: true });

    lines.forEach((line, i) => {
      const text = line.dataset.text || line.textContent;
      line.textContent = '';
      line.style.opacity = '0';

      const timer = setTimeout(() => {
        if (bootSkipped) return;
        line.style.opacity = '1';
        typeText(line, text, 7, () => {
          line.classList.add('boot-done');
          if (i === lines.length - 1) {
            // Boot complete — reveal content
            const revealTimer = setTimeout(() => {
              if (bootSkipped) return;
              bootEl.classList.add('boot-complete');
              document.getElementById('main-content')?.classList.add('loaded');
            }, 200);
            bootTimers.push(revealTimer);
          }
        });
      }, delay);
      bootTimers.push(timer);

      delay += text.length * 7 + 70;
    });
  }

  // ── PAGE TRANSITION ──
  const transition = document.getElementById('page-transition');
  if (transition) {
    // Fade out transition overlay on page load
    setTimeout(() => transition.classList.add('out'), 100);
  }

  // Intercept internal links for transition effect
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    // Only intercept local page links (not anchors, not external)
    if (href && href.endsWith('.html') && !href.startsWith('http') && !href.startsWith('#')) {
      link.addEventListener('click', e => {
        e.preventDefault();
        const target = href;

        // Create transition overlay
        const overlay = document.createElement('div');
        overlay.className = 'page-transition';
        overlay.innerHTML = `
          <div class="pt-text">CARGANDO MODULO...</div>
          <div class="pt-bar"><div class="pt-bar-fill"></div></div>
        `;
        document.body.appendChild(overlay);

        setTimeout(() => {
          window.location.href = target;
        }, 650);
      });
    }
  });

  // ── EXPAND/COLLAPSE PANELS (Hover-triggered, Terminal Effect) ──
  const allExpandBtns = document.querySelectorAll('[data-expand]');
  const isMobile = window.matchMedia('(max-width:768px)');

  function closePanel(btn) {
    const panel = document.getElementById(btn.dataset.expand);
    if (!panel || !panel.classList.contains('open')) return;
    panel.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', false);
    const items = panel.querySelectorAll('.svc-exp-list li');
    items.forEach(li => li.classList.remove('vis'));
    const termLine = panel.querySelector('.svc-term-line');
    if (termLine) termLine.classList.remove('vis');
  }

  function openPanel(btn) {
    const panel = document.getElementById(btn.dataset.expand);
    if (!panel) return;
    panel.classList.add('open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', true);

    const termLine = panel.querySelector('.svc-term-line');
    const descs = panel.querySelectorAll('.svc-term-body > p');
    const items = panel.querySelectorAll('.svc-exp-list li');

    let delay = 0;

    // Typing en la línea del terminal
    if (termLine) {
      const origText = termLine.dataset.text || termLine.textContent;
      termLine.dataset.text = origText;
      termLine.textContent = '';
      termLine.classList.add('vis');
      if (typeof typeText === 'function') {
        typeText(termLine, origText, 25, () => {
          termLine.classList.add('typing-cursor');
          setTimeout(() => termLine.classList.remove('typing-cursor'), 1200);
        });
      } else {
        termLine.textContent = origText;
      }
      delay = origText.length * 25 + 200;
    }

    // Typing en cada párrafo, uno tras otro
    descs.forEach((desc, di) => {
      const origHTML = desc.dataset.html || desc.innerHTML;
      desc.dataset.html = origHTML;
      const origPlain = desc.dataset.plain || desc.textContent;
      desc.dataset.plain = origPlain;
      desc.textContent = '';
      desc.style.opacity = '1';
      const pDelay = delay + di * 800;
      setTimeout(() => {
        if (typeof typeText === 'function') {
          typeText(desc, origPlain, 12, () => {
            desc.innerHTML = origHTML;
          });
        } else {
          desc.innerHTML = origHTML;
        }
      }, pDelay);
      delay = pDelay + origPlain.length * 12 + 100;
    });

    // Items de lista aparecen después de los párrafos
    items.forEach((li, i) => {
      const origText = li.dataset.text || li.textContent;
      li.dataset.text = origText;
      li.textContent = '';
      li.classList.remove('vis');
      setTimeout(() => {
        li.classList.add('vis');
        if (typeof typeText === 'function') {
          typeText(li, origText, 20);
        } else {
          li.textContent = origText;
        }
      }, delay + i * 300);
    });
  }

  // Build map: each svc-panel → its expand button & expand panel
  const svcPanels = document.querySelectorAll('.svc-panel');
  const hoverTimers = {};

  svcPanels.forEach(svcPanel => {
    const btn = svcPanel.querySelector('[data-expand]');
    if (!btn) return;
    const expPanel = document.getElementById(btn.dataset.expand);
    if (!expPanel) return;
    const panelId = svcPanel.id;

    function enterHandler() {
      if (isMobile.matches) return;
      clearTimeout(hoverTimers[panelId]);
      // Close all other panels
      allExpandBtns.forEach(b => {
        if (b !== btn) closePanel(b);
      });
      // Open this one if not already open
      if (!expPanel.classList.contains('open')) {
        openPanel(btn);
      }
    }

    function leaveHandler() {
      if (isMobile.matches) return;
      hoverTimers[panelId] = setTimeout(() => {
        closePanel(btn);
      }, 200);
    }

    function cancelLeave() {
      if (isMobile.matches) return;
      clearTimeout(hoverTimers[panelId]);
    }

    // Hover on the svc-panel opens expand
    svcPanel.addEventListener('mouseenter', enterHandler);
    svcPanel.addEventListener('mouseleave', leaveHandler);

    // Hovering over the expand panel keeps it open
    expPanel.addEventListener('mouseenter', cancelLeave);
    expPanel.addEventListener('mouseleave', leaveHandler);

    // Click on button (desktop fallback / accessibility)
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = expPanel.classList.contains('open');
      allExpandBtns.forEach(b => closePanel(b));
      if (!wasOpen) openPanel(btn);
    });

    // Mobile: tap anywhere on the svc-panel card to toggle
    svcPanel.addEventListener('click', () => {
      if (!isMobile.matches) return;
      const wasOpen = expPanel.classList.contains('open');
      allExpandBtns.forEach(b => closePanel(b));
      if (!wasOpen) openPanel(btn);
    });
  });

  // ── MUNET PANELS (alliance + espacios) ──
  const munetPanels = document.querySelectorAll('.munet-svc-panel');
  const munetVirtualBtns = [];
  munetPanels.forEach(mp => {
    const btn = mp.querySelector('[data-expand]');
    // For compact cards (no button), find expand panel by id convention: id + '-exp'
    const expId = btn ? btn.dataset.expand : mp.id + '-exp';
    const expPanel = document.getElementById(expId);
    if (!expPanel) return;
    const pid = mp.id;
    const isCompact = mp.classList.contains('esp-compact');

    // Create a virtual button for compact cards so openPanel/closePanel work
    const virtualBtn = btn || document.createElement('button');
    if (!btn) {
      virtualBtn.dataset.expand = expId;
      virtualBtn.setAttribute('aria-expanded', 'false');
    }
    munetVirtualBtns.push(virtualBtn);

    function closeAllMunet(except) {
      allExpandBtns.forEach(b => { if (b !== except) closePanel(b); });
      munetVirtualBtns.forEach(b => { if (b !== except) closePanel(b); });
    }

    function mEnter() {
      if (isMobile.matches) return;
      clearTimeout(hoverTimers[pid]);
      closeAllMunet(virtualBtn);
      if (!expPanel.classList.contains('open')) openPanel(virtualBtn);
    }
    function mLeave() {
      if (isMobile.matches) return;
      hoverTimers[pid] = setTimeout(() => closePanel(virtualBtn), 200);
    }
    function mCancel() {
      if (isMobile.matches) return;
      clearTimeout(hoverTimers[pid]);
    }

    mp.addEventListener('mouseenter', mEnter);
    mp.addEventListener('mouseleave', mLeave);
    expPanel.addEventListener('mouseenter', mCancel);
    expPanel.addEventListener('mouseleave', mLeave);

    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasOpen = expPanel.classList.contains('open');
        closeAllMunet();
        if (!wasOpen) openPanel(virtualBtn);
      });
    }

    mp.addEventListener('click', () => {
      if (!isCompact && !isMobile.matches) return;
      const wasOpen = expPanel.classList.contains('open');
      closeAllMunet();
      if (!wasOpen) openPanel(virtualBtn);
    });
  });

  // ── ID CARDS: tap-to-expand on mobile ──
  const idCards = document.querySelectorAll('.id-card');
  idCards.forEach(card => {
    card.addEventListener('click', () => {
      if (!isMobile.matches) return;
      const wasExpanded = card.classList.contains('expanded');
      // Close all other cards
      idCards.forEach(c => c.classList.remove('expanded'));
      // Toggle this one
      if (!wasExpanded) card.classList.add('expanded');
    });
  });

  // ── GLITCH HOVER (add to elements with .glitch-hover) ──
  // Pure CSS, no JS needed — handled in system.css

  // ── BINARY RAIN ──
  const rainCanvas = document.getElementById('binary-rain');
  if (rainCanvas) {
    const ctx = rainCanvas.getContext('2d');
    const chars = '01001011010110100101BNK>>//[OK]SYS0x#_INIT.RUN{}()LOAD';
    const fontSize = 13;
    let columns, drops;
    let rainActive = true;

    function resizeRain() {
      const rect = rainCanvas.parentElement.getBoundingClientRect();
      rainCanvas.width = rect.width;
      rainCanvas.height = rect.height;
      columns = Math.floor(rainCanvas.width / (fontSize * 1.6));
      drops = [];
      for (let i = 0; i < columns; i++) {
        drops.push({
          y: Math.random() * rainCanvas.height / fontSize,
          speed: .3 + Math.random() * .7,
          opacity: .15 + Math.random() * .85,
          isTerra: Math.random() < .08
        });
      }
    }
    resizeRain();
    window.addEventListener('resize', resizeRain);

    // Pause when not visible
    const rainObs = new IntersectionObserver(entries => {
      rainActive = entries[0].isIntersecting;
    }, { threshold: 0 });
    rainObs.observe(rainCanvas);

    function drawRain() {
      if (!rainActive) { requestAnimationFrame(drawRain); return; }

      ctx.fillStyle = 'rgba(13,13,13,.12)';
      ctx.fillRect(0, 0, rainCanvas.width, rainCanvas.height);

      ctx.font = fontSize + 'px "Space Mono", monospace';

      for (let i = 0; i < columns; i++) {
        const d = drops[i];
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize * 1.6;
        const y = d.y * fontSize;

        // Color: mostly gold, occasional terra red
        if (d.isTerra) {
          ctx.fillStyle = 'rgba(10,132,255,' + (d.opacity * .7) + ')';
          ctx.shadowColor = 'rgba(10,132,255,.3)';
        } else {
          ctx.fillStyle = 'rgba(0,224,80,' + (d.opacity * .6) + ')';
          ctx.shadowColor = 'rgba(0,224,80,.2)';
        }
        ctx.shadowBlur = 4;
        ctx.fillText(char, x, y);
        ctx.shadowBlur = 0;

        d.y += d.speed;

        if (d.y * fontSize > rainCanvas.height && Math.random() > .975) {
          d.y = 0;
          d.speed = .3 + Math.random() * .7;
          d.opacity = .15 + Math.random() * .85;
          d.isTerra = Math.random() < .08;
        }
      }
      requestAnimationFrame(drawRain);
    }
    requestAnimationFrame(drawRain);
  }

  // ── PARALLAX SUBTLE ──
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        document.querySelectorAll('[data-parallax]').forEach(el => {
          const speed = parseFloat(el.dataset.parallax) || 0.1;
          el.style.transform = `translateY(${scrollY * speed}px)`;
        });
        ticking = false;
      });
      ticking = true;
    }
  });

}); // end DOMContentLoaded
