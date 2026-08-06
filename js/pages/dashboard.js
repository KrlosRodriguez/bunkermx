/* ============================================================
   DASHBOARD — Terminal Principal JS
   Equilibrio Imposible + Contact Form
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── EQUILIBRIO IMPOSIBLE ──
  const checks = document.querySelectorAll('.bnk-eq-check input');
  const result = document.getElementById('eq-result');

  function evalEq() {
    const selected = Array.from(checks).filter(c => c.checked).map(c => c.value);

    // Update labels
    ['calidad', 'costo', 'tiempo'].forEach(v => {
      const lbl = document.getElementById('lbl-' + v);
      if (lbl) {
        lbl.classList.toggle('active', selected.includes(v));
      }
    });

    // Max 2
    if (selected.length > 2) {
      checks.forEach(c => { if (!selected.slice(-2).includes(c.value)) c.checked = false; });
      evalEq();
      return;
    }

    if (selected.length < 2) {
      result.textContent = selected.length === 0 ? '> Selecciona 2 opciones' : '> Selecciona 1 mas';
      result.style.color = 'rgba(226,217,197,0.3)';
      return;
    }

    const map = {
      'calidad,costo': '> No sera RAPIDO',
      'calidad,tiempo': '> No sera BARATO',
      'costo,tiempo': '> No sera BUENO'
    };
    const key = selected.sort().join(',');
    result.textContent = map[key] || '';
    result.style.color = '#00E050';
  }

  checks.forEach(c => c.addEventListener('change', evalEq));

  // ── CONTACT FORM ──
  const form = document.getElementById('contact-form');
  const status = document.getElementById('form-status');

  if (form) {
    // Inline validation on blur
    form.querySelectorAll('.hud-input[required]').forEach(input => {
      input.addEventListener('blur', () => {
        const err = document.getElementById(input.id + '-err');
        const invalid = !input.value.trim() || (input.type === 'email' && !input.validity.valid);
        input.classList.toggle('error', invalid);
        if (err) err.classList.toggle('visible', invalid);
      });
      input.addEventListener('input', () => {
        if (input.classList.contains('error')) {
          const valid = input.value.trim() && (input.type !== 'email' || input.validity.valid);
          if (valid) {
            input.classList.remove('error');
            const err = document.getElementById(input.id + '-err');
            if (err) err.classList.remove('visible');
          }
        }
      });
    });

    form.addEventListener('submit', function(e) {
      e.preventDefault();

      // Validate all required fields
      let firstInvalid = null;
      form.querySelectorAll('.hud-input[required]').forEach(input => {
        const err = document.getElementById(input.id + '-err');
        const invalid = !input.value.trim() || (input.type === 'email' && !input.validity.valid);
        input.classList.toggle('error', invalid);
        if (err) err.classList.toggle('visible', invalid);
        if (invalid && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) { firstInvalid.focus(); return; }

      const btn = this.querySelector('button[type="submit"]');
      const originalHTML = btn.innerHTML;

      // Simulated send sequence
      btn.innerHTML = '<span>TRANSMITTING...</span>';
      btn.disabled = true;
      status.textContent = '> ESTABLISHING CONNECTION...';
      status.style.color = '#00E050';

      setTimeout(() => {
        status.textContent = '> TRANSMITTING DATA... [████████░░] 80%';
      }, 600);

      setTimeout(() => {
        status.textContent = '> TRANSMISSION COMPLETE';
        status.style.color = '#00E050';
        btn.innerHTML = '<span>[ MENSAJE ENVIADO ]</span>';

        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.disabled = false;
          status.textContent = '';
          form.reset();
        }, 3000);
      }, 1500);
    });
  }

});
