/* ============================================================
   MODULO: PROYECTOS — Year Groups, Filters & Expand
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  const grid  = document.getElementById('projGrid');
  const btns  = document.querySelectorAll('.f-btn');
  const cards = document.querySelectorAll('.proj-card[data-c]');
  const seps  = document.querySelectorAll('.region-sep');
  const count = document.getElementById('projCount');
  const yrHeads = document.querySelectorAll('.yr-head');

  // ── Year Group Accordion ──
  yrHeads.forEach(head => {
    head.addEventListener('click', () => {
      const cards_el = head.nextElementSibling;
      const isOpen = head.classList.contains('open');

      // Close all other year groups
      yrHeads.forEach(h => {
        h.classList.remove('open');
        h.nextElementSibling.classList.remove('open');
      });

      // Toggle clicked group
      if (!isOpen) {
        head.classList.add('open');
        cards_el.classList.add('open');
      }
    });
  });

  // ── Filter Logic ──
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const f = b.dataset.f;

    // Close any open expands
    document.querySelectorAll('.proj-card-expand.open').forEach(e => e.classList.remove('open'));
    document.querySelectorAll('.proj-card--expand.open').forEach(e => e.classList.remove('open'));

    if (f === 'all') {
      // ── TODOS mode: show year groups, hide flat grid ──
      grid.classList.remove('proj-grid--filtered');

      // Close all year groups
      yrHeads.forEach(h => {
        h.classList.remove('open');
        h.nextElementSibling.classList.remove('open');
      });

      // Show all cards and year groups
      cards.forEach(c => {
        c.classList.remove('hidden', 'fading-out', 'fading-in');
        c.style.animationDelay = '';
      });

      // Show all year groups
      document.querySelectorAll('.yr-group').forEach(g => g.style.display = '');

      // Show seps inside yr-cards
      seps.forEach(s => s.style.display = 'flex');

      // Update counter
      if (count) count.textContent = cards.length;

    } else {
      // ── Filtered mode: flat grid, no year headers ──
      grid.classList.add('proj-grid--filtered');

      // Fade out visible cards
      cards.forEach(c => {
        if (!c.classList.contains('hidden')) {
          c.classList.add('fading-out');
        }
      });

      setTimeout(() => {
        let visible = 0;
        let stagger = 0;

        // Show/hide year groups based on whether they contain matching cards
        document.querySelectorAll('.yr-group').forEach(g => {
          const groupCards = g.querySelectorAll('.proj-card[data-c]');
          let hasVisible = false;

          groupCards.forEach(c => {
            c.classList.remove('fading-out', 'fading-in');
            const show = c.dataset.c === f;

            if (show) {
              c.classList.remove('hidden');
              c.style.animationDelay = (stagger * 0.05) + 's';
              c.classList.add('fading-in');
              stagger++;
              visible++;
              hasVisible = true;
            } else {
              c.classList.add('hidden');
            }
          });

          // Hide entire year group if no cards match
          g.style.display = hasVisible ? '' : 'none';
        });

        // Show/hide region separators
        seps.forEach(s => {
          if (f === 'venues') {
            s.style.display = 'flex';
          } else if (f === 'discografia') {
            s.style.display = 'none';
          } else {
            s.style.display = 'none';
          }
        });

        // Update counter
        if (count) count.textContent = visible;

        // Clean up animation classes
        setTimeout(() => {
          cards.forEach(c => {
            c.classList.remove('fading-in');
            c.style.animationDelay = '';
          });
        }, 600);

      }, 200);
    }
  }));

  // ── Expandable project cards ──
  [['munetProjCard', 'munetProjExp'], ['pasatonoCard', 'pasatonoExp']].forEach(([cId, pId]) => {
    const card = document.getElementById(cId);
    const panel = document.getElementById(pId);
    if (card && panel) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.proj-card-expand')) return;
        card.classList.toggle('open');
        panel.classList.toggle('open');
      });
    }
  });

  // ── Initial count ──
  if (count) {
    count.textContent = cards.length;
  }

});
