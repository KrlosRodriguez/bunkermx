/* ============================================================
   MODULO: ESENCIA — Atributos toggle & Equilibrio Imposible
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  // ── Atributos toggle (touch/click) ──
  document.querySelectorAll('.mf-atrib').forEach(a => {
    a.addEventListener('click', () => {
      document.querySelectorAll('.mf-atrib').forEach(o => { if (o !== a) o.classList.remove('open'); });
      a.classList.toggle('open');
    });
  });

  // ── Declaraciones toggle (touch/click) ──
  document.querySelectorAll('.bnk-decl-card').forEach(d => {
    d.addEventListener('click', () => {
      document.querySelectorAll('.bnk-decl-card').forEach(o => { if (o !== d) o.classList.remove('open'); });
      d.classList.toggle('open');
    });
  });


});
