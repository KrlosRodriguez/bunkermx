/* ============================================================
   COTIZADOR MUNET — Versión 2 (Wizard por pasos)
   Opción B: cálculo automático de tarifas por día
   Demo independiente — no afecta cotizador-munet
   ============================================================ */

(function () {
  'use strict';

  /* ── CONFIGURACIÓN ── */
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxTDbIjGqYyyGZUiGpYc-km-flxgXkluGSaQ-dE1hFymuTgTgOvKA-wvHzjcge65PUH/exec';

  /* ── DATOS DE ESPACIOS ── */
  var SPACES = [
    {
      id: 'explanada', name: 'EXPLANADA', color: '#00FF41',
      m2: '10,000 M\u00B2', cap: '', note: '',
      priv: { regular: 300000, weekend: 350000, montaje: 150000 },
      pub:  true,
      onlyPrivado: false, onlySala: false,
    },
    {
      id: 'foro', name: 'FORO', color: '#00D4FF',
      m2: '1,400 M\u00B2', cap: '+400 M\u00B2 OFICINAS', note: '',
      priv: { regular: 200000, weekend: 250000, montaje: 100000 },
      pub:  true,
      onlyPrivado: false, onlySala: false,
    },
    {
      id: 'lobby', name: 'LOBBY', color: '#F0C040',
      m2: '1,200 M\u00B2', cap: 'DOBLE ALTURA', note: '',
      priv: { regular: 230000, weekend: 280000, montaje: 150000 },
      pub:  null, onlyPrivado: true, onlySala: false,
    },
    {
      id: 'auditorio', name: 'AUDITORIO', color: '#FF8C00',
      m2: '246 PERSONAS', cap: 'BUTACAS FIJAS', note: '',
      priv: { regular: 60000, weekend: 60000, montaje: 0 },
      pub:  true,
      onlyPrivado: false, onlySala: false, montajeLabel: 'SIN COSTO',
    },
    {
      id: 'jardin', name: 'JARD\u00CDN SOCIAL', color: '#7FFF00',
      m2: '2,576 M\u00B2', cap: '400 PERSONAS', note: '',
      priv: { regular: 70000, weekend: 70000, montaje: 0 },
      pub:  null, onlyPrivado: true, onlySala: false, montajeLabel: 'COTIZAR',
    },
    {
      id: 'salas', name: 'SALAS CAPACIT.', color: '#B060FF',
      m2: '60\u201378 M\u00B2 POR SALA', cap: '4 SALAS INDEP.',
      note: '\u26A0 SOLO LUN\u2013JUE \u00B7 PRECIO POR SALA',
      priv: { regular: 20000, weekend: null, montaje: 0 },
      pub:  null, onlyPrivado: true, onlySala: true,
    },
    {
      id: 'velaria', name: 'VELARIA', color: '#FF3399',
      m2: '350 M\u00B2', cap: '300 PERSONAS', note: '',
      priv: { regular: 80000, weekend: 80000, montaje: 0 },
      pub:  null, onlyPrivado: true, onlySala: false, montajeLabel: 'COTIZAR',
    },
    {
      id: 'expo', name: 'BLACK BOX', color: '#FF4455',
      m2: '612 M\u00B2', cap: '200 PERSONAS', note: '',
      priv: { regular: 150000, weekend: 150000, montaje: 75000 },
      pub:  null, onlyPrivado: true, onlySala: false,
    },
  ];

  /* ── ESTADO ── */
  var tipo = 'privado';
  var selected = {};  // { spaceId: { montajeDays: 0, eventDays: [...] } }
  var cotizacionEnviada = false;
  var currentFolio = null;
  var currentStep = 1;

  /* ── UTILIDADES ── */
  function formatMXN(n) {
    if (n === null || n === undefined) return '\u2014';
    return '$' + n.toLocaleString('es-MX');
  }

  function generateFolio() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, '0');
    var dd = String(now.getDate()).padStart(2, '0');
    var rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    return 'MNT-' + yy + mm + dd + '-' + rand;
  }

  function hexToRGB(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  function formatFecha(val) {
    if (!val) return '';
    var p = val.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  /* ── NOMBRES DE DÍA ── */
  var DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  var MONTH_NAMES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  // Devuelve si una fecha es weekend (vie-sáb)
  function isWeekendDate(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    var dow = d.getDay();
    return dow === 5 || dow === 6;
  }

  // Calcula desglose para un subconjunto de fechas
  function calcDaysBreakdownForDates(dates) {
    var regular = 0, weekend = 0;
    dates.forEach(function (dateStr) {
      if (isWeekendDate(dateStr)) weekend++;
      else regular++;
    });
    return { regular: regular, weekend: weekend, total: regular + weekend };
  }

  // Formato legible de una fecha: "LUN 28 JUL"
  function formatDayLabel(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    return DAY_NAMES[d.getDay()] + ' ' + d.getDate() + ' ' + MONTH_NAMES[d.getMonth()];
  }

  // Calcula el costo de renta de un espacio basado en sus días seleccionados
  function calcSpaceRenta(sp) {
    // Obtener desglose de días del venue (per-venue o global)
    var bd = getSpaceDaysBreakdown(sp);

    if (tipo === 'publico' && !sp.pub) return null;
    if (!sp.priv) return null;
    if (sp.onlySala && bd.weekend > 0) return null;

    var regularPrice = sp.priv.regular || 0;
    var weekendPrice = sp.priv.weekend ?? regularPrice;

    return (bd.regular * regularPrice) + (bd.weekend * weekendPrice);
  }

  // Obtiene el desglose de días para un espacio específico
  function getSpaceDaysBreakdown(sp) {
    if (selected[sp.id] && selected[sp.id].eventDays && selected[sp.id].eventDays.length > 0) {
      return calcDaysBreakdownForDates(selected[sp.id].eventDays);
    }
    return { regular: 0, weekend: 0, total: 0 };
  }

  function renderSpaceCalendar(spaceId) {
    var state = selected[spaceId];
    if (!state) return '';

    var viewMonth = state.calViewMonth;
    var viewYear = state.calViewYear;

    var firstDay = new Date(viewYear, viewMonth, 1);
    var startDow = (firstDay.getDay() + 6) % 7; // lun=0
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var spaceDays = state.eventDays || [];

    var html = '<div class="v2-vcal" data-space="' + spaceId + '">';

    // Header con navegación
    html += '<div class="v2-vcal-header">' +
      '<button type="button" class="v2-vcal-nav v2-vcal-prev" data-space="' + spaceId + '" data-dir="-1">&#8249;</button>' +
      '<span class="v2-vcal-month">' + MONTH_NAMES[viewMonth] + ' ' + viewYear + '</span>' +
      '<button type="button" class="v2-vcal-nav v2-vcal-next" data-space="' + spaceId + '" data-dir="1">&#8250;</button>' +
    '</div>';

    // Weekday headers
    html += '<div class="v2-vcal-weekdays">' +
      '<span>LUN</span><span>MAR</span><span>MI\u00C9</span><span>JUE</span>' +
      '<span>VIE</span><span>S\u00C1B</span><span>DOM</span>' +
    '</div>';

    // Grid
    html += '<div class="v2-vcal-grid">';

    // Empty cells before first day
    for (var e = 0; e < startDow; e++) {
      html += '<div class="v2-vcal-cell v2-vcal-cell--empty"></div>';
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateObj = new Date(viewYear, viewMonth, d);
      var yyyy = dateObj.getFullYear();
      var mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      var dd = String(d).padStart(2, '0');
      var dateStr = yyyy + '-' + mm + '-' + dd;

      var dow = (dateObj.getDay() + 6) % 7;
      var isWknd = dow === 4 || dow === 5; // vie=4, sáb=5 (lun-based)
      var isPast = dateObj < today;
      var isSelected = spaceDays.indexOf(dateStr) >= 0;
      var isToday = dateObj.getTime() === today.getTime();

      var cls = 'v2-vcal-cell';
      if (isWknd) cls += ' v2-vcal-cell--wknd';
      if (isPast) cls += ' v2-vcal-cell--past';
      if (isSelected) cls += ' v2-vcal-cell--selected';
      if (isToday) cls += ' v2-vcal-cell--today';

      html += '<div class="' + cls + '" data-space="' + spaceId + '" data-date="' + dateStr + '">' + d + '</div>';
    }

    html += '</div>'; // grid

    // Desglose debajo del calendario
    var bd = calcDaysBreakdownForDates(spaceDays);
    if (bd.total > 0) {
      html += '<div class="v2-vcal-breakdown">';
      if (bd.regular > 0) {
        html += '<span class="v2-vcal-bd-tag">LUN\u2013JUE: ' + bd.regular + '</span>';
      }
      if (bd.weekend > 0) {
        html += '<span class="v2-vcal-bd-tag v2-vcal-bd-tag--wknd">VIE\u2013S\u00C1B: ' + bd.weekend + '</span>';
      }
      html += '<span class="v2-vcal-bd-total">' + bd.total + ' D\u00CDA' + (bd.total > 1 ? 'S' : '') + '</span>';
      html += '</div>';
    } else {
      html += '<div class="v2-vcal-breakdown"><span class="v2-vcal-bd-empty">SELECCIONA LOS D\u00CDAS DEL EVENTO</span></div>';
    }

    html += '</div>'; // v2-vcal

    return html;
  }

  // Verifica si un espacio está disponible con las fechas actuales
  function isSpaceAvailable(sp) {
    if (tipo === 'publico' && sp.onlyPrivado) return false;
    // Salas: verificar si hay días weekend en los días seleccionados del venue
    if (sp.onlySala) {
      var bd = getSpaceDaysBreakdown(sp);
      if (bd.weekend > 0) return false;
    }
    return true;
  }

  function getMontajeUnit(sp) {
    return sp.priv?.montaje || 0;
  }

  /* ── WIZARD — Gestión de pasos ── */
  function goToStep(stepNum) {
    currentStep = stepNum;
    for (var i = 1; i <= 4; i++) {
      var el = document.getElementById('step' + i);
      el.classList.remove('v2-step--active', 'v2-step--done', 'v2-step--locked');
      if (i < stepNum) {
        el.classList.add('v2-step--done');
      } else if (i === stepNum) {
        el.classList.add('v2-step--active');
      } else {
        el.classList.add('v2-step--locked');
      }
    }

    setTimeout(function () {
      document.getElementById('step' + stepNum).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    if (stepNum === 3) { buildCards(); }
    if (stepNum === 4) renderResumen();
  }

  function isStep1Valid() {
    var cliente  = document.getElementById('v2Cliente').value.trim();
    var contacto = document.getElementById('v2Contacto').value.trim();
    var telefono = document.getElementById('v2Telefono').value.trim();
    var correo   = document.getElementById('v2Correo').value.trim();
    return cliente && contacto && (telefono || correo);
  }

  function validateStep1() {
    document.getElementById('btnNext1').disabled = !isStep1Valid();
  }

  function hasSpacesSelected() {
    var ids = Object.keys(selected);
    if (ids.length === 0) return false;
    return ids.some(function (id) {
      return selected[id].eventDays && selected[id].eventDays.length > 0;
    });
  }

  function validateStep3() {
    document.getElementById('btnNext3').disabled = !hasSpacesSelected();
  }

  /* ── CONSTRUCCIÓN DE CARDS ── */
  function buildCards() {
    var grid = document.getElementById('v2SpacesGrid');
    if (!grid) return;
    grid.innerHTML = '';

    SPACES.forEach(function (sp) {
      var isSel = !!selected[sp.id];
      var isDisabled = !isSpaceAvailable(sp);
      var montDays = selected[sp.id]?.montajeDays || 0;
      var montUnitario = sp.priv?.montaje || 0;
      var rentaTotal = calcSpaceRenta(sp);
      var spBdCard = getSpaceDaysBreakdown(sp);

      // Deseleccionar si quedó deshabilitado
      if (isDisabled && isSel) {
        delete selected[sp.id];
        isSel = false;
      }

      // Precio display
      var precioDisplay = '\u2014';
      var periodoDisplay = '';

      if (tipo === 'privado') {
        if (sp.onlySala && spBdCard.weekend > 0) {
          precioDisplay = 'NO DISP.';
          periodoDisplay = 'SOLO LUN\u2013JUE';
        } else if (sp.priv) {
          // Mostrar ambas tarifas si hay ambos tipos de día
          if (spBdCard.regular > 0 && spBdCard.weekend > 0 && sp.priv.regular !== (sp.priv.weekend ?? sp.priv.regular)) {
            precioDisplay = formatMXN(sp.priv.regular) + ' / ' + formatMXN(sp.priv.weekend ?? sp.priv.regular);
            periodoDisplay = 'LUN\u2013JUE / VIE\u2013S\u00C1B';
          } else if (spBdCard.weekend > 0 && spBdCard.regular === 0) {
            precioDisplay = formatMXN(sp.priv.weekend ?? sp.priv.regular);
            periodoDisplay = 'VIE\u2013S\u00C1B / D\u00CDA';
          } else {
            precioDisplay = formatMXN(sp.priv.regular);
            periodoDisplay = sp.id === 'salas' ? 'POR SALA / D\u00CDA' : 'LUN\u2013JUE / D\u00CDA';
          }
        }
      } else {
        if (sp.pub && sp.priv) {
          // Público usa mismas tarifas que privado
          if (spBdCard.regular > 0 && spBdCard.weekend > 0 && sp.priv.regular !== (sp.priv.weekend ?? sp.priv.regular)) {
            precioDisplay = formatMXN(sp.priv.regular) + ' / ' + formatMXN(sp.priv.weekend ?? sp.priv.regular);
            periodoDisplay = 'LUN\u2013JUE / VIE\u2013S\u00C1B';
          } else if (spBdCard.weekend > 0 && spBdCard.regular === 0) {
            precioDisplay = formatMXN(sp.priv.weekend ?? sp.priv.regular);
            periodoDisplay = 'VIE\u2013S\u00C1B / D\u00CDA';
          } else {
            precioDisplay = formatMXN(sp.priv.regular);
            periodoDisplay = 'LUN\u2013JUE / D\u00CDA';
          }
        } else {
          precioDisplay = 'SOLO PRIVADO';
        }
      }

      var montajeText = sp.montajeLabel
        ? sp.montajeLabel
        : (montUnitario === 0 ? 'SIN COSTO' : formatMXN(montUnitario) + ' / D\u00CDA');

      var card = document.createElement('div');
      card.className = 'v2-space-card' + (isSel ? ' selected' : '') + (isDisabled ? ' disabled' : '');
      card.style.borderLeftColor = sp.color;

      (function (spaceId, disabled) {
        card.addEventListener('click', function () {
          if (!disabled) toggleSpace(spaceId);
        });
      })(sp.id, isDisabled);

      // Calendario per-venue
      var daysPickerHTML = '';
      if (isSel) {
        daysPickerHTML = renderSpaceCalendar(sp.id);
      }

      // Build desglose para card seleccionada
      var desgloseHTML = '';
      if (isSel) {
        var spBd = spBdCard;

        if (tipo === 'privado' && sp.priv) {
          var regPrice = sp.priv.regular || 0;
          var wkdPrice = sp.priv.weekend ?? regPrice;

          if (spBd.regular > 0) {
            desgloseHTML += '<div class="v2-sc-montaje">' +
              '<div class="v2-montaje-label">' + spBd.regular + ' D\u00CDA' + (spBd.regular > 1 ? 'S' : '') + ' LUN\u2013JUE \u00B7 ' + formatMXN(regPrice) + ' / D\u00CDA</div>' +
              '<div class="v2-montaje-days"><div class="v2-montaje-subtotal" style="color:' + sp.color + ';">' + formatMXN(spBd.regular * regPrice) + '</div></div>' +
            '</div>';
          }
          if (spBd.weekend > 0) {
            desgloseHTML += '<div class="v2-sc-montaje">' +
              '<div class="v2-montaje-label">' + spBd.weekend + ' D\u00CDA' + (spBd.weekend > 1 ? 'S' : '') + ' VIE\u2013S\u00C1B \u00B7 ' + formatMXN(wkdPrice) + ' / D\u00CDA</div>' +
              '<div class="v2-montaje-days"><div class="v2-montaje-subtotal" style="color:' + sp.color + ';">' + formatMXN(spBd.weekend * wkdPrice) + '</div></div>' +
            '</div>';
          }
        } else if (tipo === 'publico' && sp.pub && sp.priv) {
          var regPrice = sp.priv.regular || 0;
          var wkdPrice = sp.priv.weekend ?? regPrice;

          if (spBd.regular > 0) {
            desgloseHTML += '<div class="v2-sc-montaje">' +
              '<div class="v2-montaje-label">' + spBd.regular + ' D\u00CDA' + (spBd.regular > 1 ? 'S' : '') + ' LUN\u2013JUE \u00B7 ' + formatMXN(regPrice) + ' / D\u00CDA</div>' +
              '<div class="v2-montaje-days"><div class="v2-montaje-subtotal" style="color:' + sp.color + ';">' + formatMXN(spBd.regular * regPrice) + '</div></div>' +
            '</div>';
          }
          if (spBd.weekend > 0) {
            desgloseHTML += '<div class="v2-sc-montaje">' +
              '<div class="v2-montaje-label">' + spBd.weekend + ' D\u00CDA' + (spBd.weekend > 1 ? 'S' : '') + ' VIE\u2013S\u00C1B \u00B7 ' + formatMXN(wkdPrice) + ' / D\u00CDA</div>' +
              '<div class="v2-montaje-days"><div class="v2-montaje-subtotal" style="color:' + sp.color + ';">' + formatMXN(spBd.weekend * wkdPrice) + '</div></div>' +
            '</div>';
          }
        }
      }

      // Montaje (solo si está seleccionado)
      var montajeHTML = '';
      if (isSel) {
        montajeHTML = '<div class="v2-sc-montaje">' +
          '<div class="v2-montaje-label">D\u00CDAS MONTAJE \u00B7 ' + montajeText + '</div>' +
          '<div class="v2-montaje-days">' +
            '<div class="v2-days-input">' +
              '<button class="v2-mt-minus" data-space="' + sp.id + '" data-delta="-1">\u2212</button>' +
              '<div class="v2-day-count">' + montDays + '</div>' +
              '<button class="v2-mt-plus" data-space="' + sp.id + '" data-delta="1">+</button>' +
            '</div>' +
            '<div class="v2-montaje-subtotal" style="color:' + sp.color + ';">' +
              (montUnitario > 0 && montDays > 0 ? formatMXN(montUnitario * montDays) : '\u2014') +
            '</div>' +
          '</div>' +
        '</div>';
      }

      // Total de renta del espacio
      var totalLineHTML = '';
      if (isSel && rentaTotal !== null) {
        var montTotal = montUnitario * montDays;
        var espacioGrandTotal = rentaTotal + montTotal;
        totalLineHTML = '<div class="v2-sc-montaje" style="border-top:1px solid rgba(0,255,65,.12);background:rgba(0,255,65,.03);">' +
          '<div class="v2-montaje-label">TOTAL ESPACIO</div>' +
          '<div class="v2-montaje-days"><div class="v2-montaje-subtotal" style="color:' + sp.color + ';font-size:24px;">' + formatMXN(espacioGrandTotal) + '</div></div>' +
        '</div>';
      }

      card.innerHTML =
        '<div class="v2-sc-inner">' +
          '<div class="v2-sc-check">' +
            '<div class="v2-checkbox">' +
              '<svg class="v2-checkbox-tick" viewBox="0 0 12 9" fill="none">' +
                '<path d="M1 4L4.5 7.5L11 1" stroke="#0D0D0D" stroke-width="2" stroke-linecap="round"/>' +
              '</svg>' +
            '</div>' +
          '</div>' +
          '<div class="v2-sc-info">' +
            '<div class="v2-sc-name" style="color:' + sp.color + ';">' + sp.name + '</div>' +
            '<div class="v2-sc-meta">' +
              '<span class="v2-sc-m2">' + sp.m2 + '</span>' +
              (sp.cap ? '<span class="v2-sc-cap">' + sp.cap + '</span>' : '') +
              (sp.note ? '<span class="v2-sc-note">' + sp.note + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="v2-sc-price">' +
            '<div class="v2-sc-price-main" style="color:' + sp.color + ';">' + precioDisplay + '</div>' +
            '<div class="v2-sc-price-period">' + periodoDisplay + '</div>' +
          '</div>' +
        '</div>' +
        daysPickerHTML + desgloseHTML + montajeHTML + totalLineHTML;

      grid.appendChild(card);
    });

    // Montaje buttons
    grid.querySelectorAll('.v2-mt-minus, .v2-mt-plus').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        changeMontaje(btn.getAttribute('data-space'), parseInt(btn.getAttribute('data-delta'), 10));
      });
    });

    // Calendario per-venue: clicks en días
    grid.querySelectorAll('.v2-vcal-cell:not(.v2-vcal-cell--empty):not(.v2-vcal-cell--past)').forEach(function (cell) {
      cell.addEventListener('click', function (e) {
        e.stopPropagation();
        var spaceId = cell.getAttribute('data-space');
        var dateStr = cell.getAttribute('data-date');
        toggleSpaceDay(spaceId, dateStr);
      });
    });

    // Calendario per-venue: navegación mes
    grid.querySelectorAll('.v2-vcal-nav').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var spaceId = btn.getAttribute('data-space');
        var dir = parseInt(btn.getAttribute('data-dir'), 10);
        if (!selected[spaceId]) return;
        selected[spaceId].calViewMonth += dir;
        if (selected[spaceId].calViewMonth > 11) {
          selected[spaceId].calViewMonth = 0;
          selected[spaceId].calViewYear++;
        } else if (selected[spaceId].calViewMonth < 0) {
          selected[spaceId].calViewMonth = 11;
          selected[spaceId].calViewYear--;
        }
        buildCards();
      });
    });
  }

  /* ── CONTROLES ── */
  function setTipo(t, btnEl) {
    tipo = t;
    Object.keys(selected).forEach(function (id) {
      var sp = SPACES.find(function (s) { return s.id === id; });
      if (!isSpaceAvailable(sp)) delete selected[id];
    });
    document.querySelectorAll('.v2-tipo-btn').forEach(function (b) { b.classList.remove('active'); });
    btnEl.classList.add('active');
    if (currentStep === 3) buildCards();
    validateStep3();
  }

  function toggleSpace(id) {
    if (selected[id]) {
      delete selected[id];
    } else {
      var now = new Date();
      selected[id] = {
        montajeDays: 0,
        eventDays: [],
        calViewMonth: now.getMonth(),
        calViewYear: now.getFullYear()
      };
    }
    if (cotizacionEnviada) resetEnvio();
    buildCards();
    validateStep3();
  }

  function toggleSpaceDay(spaceId, dateStr) {
    if (!selected[spaceId]) return;
    var days = selected[spaceId].eventDays;
    var idx = days.indexOf(dateStr);
    if (idx >= 0) {
      days.splice(idx, 1);
    } else {
      days.push(dateStr);
      days.sort();
    }
    if (cotizacionEnviada) resetEnvio();
    buildCards();
    validateStep3();
  }

  function changeMontaje(id, delta) {
    if (!selected[id]) return;
    selected[id].montajeDays = Math.max(0, (selected[id].montajeDays || 0) + delta);
    if (cotizacionEnviada) resetEnvio();
    buildCards();
  }

  function resetEnvio() {
    cotizacionEnviada = false;
    currentFolio = null;
    var btn = document.getElementById('v2CtaBtn');
    btn.textContent = 'ENVIAR COTIZACI\u00D3N';
    btn.classList.remove('v2-cta-btn--download', 'v2-cta-btn--sending');
    var folio = document.getElementById('v2Folio');
    folio.classList.remove('visible');
    folio.textContent = '';
  }

  /* ── RESUMEN (Paso 4) ── */
  function renderResumen() {
    var cliente     = document.getElementById('v2Cliente').value.trim();
    var agencia     = document.getElementById('v2Agencia').value.trim();
    var evento      = document.getElementById('v2Evento').value.trim();
    var contacto    = document.getElementById('v2Contacto').value.trim();
    var telefono    = document.getElementById('v2Telefono').value.trim();
    var correo      = document.getElementById('v2Correo').value.trim();
    var fechaInicio = ''; // Task 3 adaptará fechas por venue
    var fechaFin    = '';
    var asistentes  = document.getElementById('v2Asistentes').value.trim();

    document.getElementById('v2ResCliente').textContent = cliente || '\u2014';

    var agRow = document.getElementById('v2ResAgenciaRow');
    if (agencia) { agRow.style.display = 'flex'; document.getElementById('v2ResAgencia').textContent = agencia; }
    else { agRow.style.display = 'none'; }

    var evRow = document.getElementById('v2ResEventoRow');
    if (evento) { evRow.style.display = 'flex'; document.getElementById('v2ResEvento').textContent = evento; }
    else { evRow.style.display = 'none'; }

    document.getElementById('v2ResContacto').textContent = contacto || '\u2014';

    var tc = [telefono, correo].filter(function (v) { return v; }).join(' \u00B7 ');
    document.getElementById('v2ResTelCorreo').textContent = tc || '\u2014';

    var fechaStr = formatFecha(fechaInicio);
    if (fechaFin && fechaFin !== fechaInicio) fechaStr += ' \u2014 ' + formatFecha(fechaFin);
    document.getElementById('v2ResFechas').textContent = fechaStr || '\u2014';

    var asRow = document.getElementById('v2ResAsistentesRow');
    if (asistentes) { asRow.style.display = 'flex'; document.getElementById('v2ResAsistentes').textContent = parseInt(asistentes, 10).toLocaleString('es-MX'); }
    else { asRow.style.display = 'none'; }

    document.getElementById('v2ResTipo').textContent = tipo === 'privado' ? 'EVENTO PRIVADO' : 'EVENTO P\u00DABLICO';

    // Desglose de días — Task 3 adaptará esto por venue; por ahora se omite
    document.getElementById('v2ResDias').textContent = '\u2014';

    // Horario
    var horaInicio = document.getElementById('v2HoraInicio').value;
    var horaFin    = document.getElementById('v2HoraFin').value;
    var horarioRow = document.getElementById('v2ResHorarioRow');
    if (horaInicio || horaFin) {
      var horarioStr = (horaInicio || '—') + ' — ' + (horaFin || '—');
      horarioRow.style.display = 'flex';
      document.getElementById('v2ResHorario').textContent = horarioStr;
    } else {
      horarioRow.style.display = 'none';
    }

    // Descripción
    var descripcion = document.getElementById('v2Descripcion').value.trim();
    var descRow = document.getElementById('v2ResDescripcionRow');
    if (descripcion) {
      descRow.style.display = 'flex';
      document.getElementById('v2ResDescripcion').textContent = descripcion;
    } else {
      descRow.style.display = 'none';
    }

    // Espacios
    var ids = Object.keys(selected);
    var html = '';
    var totalRenta = 0;
    var totalMontaje = 0;

    ids.forEach(function (id) {
      var sp = SPACES.find(function (s) { return s.id === id; });
      var rentaEspacio = calcSpaceRenta(sp) || 0;
      var montUnit = getMontajeUnit(sp);
      var montDays = selected[id].montajeDays || 0;
      var montTotal = montUnit * montDays;
      var spBd = getSpaceDaysBreakdown(sp);

      totalRenta += rentaEspacio;
      totalMontaje += montTotal;

      // Días seleccionados para este venue
      var diasVenue = spBd.total + ' d\u00EDa' + (spBd.total > 1 ? 's' : '');
      if (spBd.regular > 0 && spBd.weekend > 0) {
        diasVenue += ' (' + spBd.regular + ' LUN\u2013JUE + ' + spBd.weekend + ' VIE\u2013S\u00C1B)';
      } else if (spBd.weekend > 0) {
        diasVenue += ' (VIE\u2013S\u00C1B)';
      } else {
        diasVenue += ' (LUN\u2013JUE)';
      }

      // Desglose detallado
      var detailLines = '';
      detailLines += '<div class="v2-res-esp-detail" style="color:' + sp.color + ';">' + diasVenue + '</div>';

      if (tipo === 'privado' && sp.priv) {
        if (spBd.regular > 0) {
          detailLines += '<div class="v2-res-esp-detail" style="color:' + sp.color + ';">' +
            spBd.regular + ' d\u00EDa' + (spBd.regular > 1 ? 's' : '') + ' LUN\u2013JUE \u00B7 ' + formatMXN(sp.priv.regular) + '/d\u00EDa \u00B7 ' + formatMXN(spBd.regular * sp.priv.regular) +
          '</div>';
        }
        if (spBd.weekend > 0) {
          var wkdP = sp.priv.weekend ?? sp.priv.regular;
          detailLines += '<div class="v2-res-esp-detail" style="color:' + sp.color + ';">' +
            spBd.weekend + ' d\u00EDa' + (spBd.weekend > 1 ? 's' : '') + ' VIE\u2013S\u00C1B \u00B7 ' + formatMXN(wkdP) + '/d\u00EDa \u00B7 ' + formatMXN(spBd.weekend * wkdP) +
          '</div>';
        }
      } else if (tipo === 'publico' && sp.pub && sp.priv) {
        if (spBd.regular > 0) {
          detailLines += '<div class="v2-res-esp-detail" style="color:' + sp.color + ';">' +
            spBd.regular + ' d\u00EDa' + (spBd.regular > 1 ? 's' : '') + ' LUN\u2013JUE \u00B7 ' + formatMXN(sp.priv.regular) + '/d\u00EDa \u00B7 ' + formatMXN(spBd.regular * sp.priv.regular) +
          '</div>';
        }
        if (spBd.weekend > 0) {
          var wkdP = sp.priv.weekend ?? sp.priv.regular;
          detailLines += '<div class="v2-res-esp-detail" style="color:' + sp.color + ';">' +
            spBd.weekend + ' d\u00EDa' + (spBd.weekend > 1 ? 's' : '') + ' VIE\u2013S\u00C1B \u00B7 ' + formatMXN(wkdP) + '/d\u00EDa \u00B7 ' + formatMXN(spBd.weekend * wkdP) +
          '</div>';
        }
      }
      if (montDays > 0) {
        detailLines += '<div class="v2-res-esp-detail" style="color:' + sp.color + ';">+ ' + montDays + ' d\u00EDa' + (montDays > 1 ? 's' : '') + ' montaje \u00B7 ' + formatMXN(montTotal) + '</div>';
      }

      html +=
        '<div class="v2-res-espacio">' +
          '<div>' +
            '<div class="v2-res-esp-name" style="color:' + sp.color + ';">' + sp.name + '</div>' +
            '<div class="v2-res-esp-detail">' + sp.m2 + ' \u00B7 ' + (tipo === 'privado' ? 'PRIVADO' : 'P\u00DABLICO') + '</div>' +
            detailLines +
          '</div>' +
          '<div class="v2-res-esp-amount" style="color:' + sp.color + ';">' +
            formatMXN(rentaEspacio + montTotal) +
          '</div>' +
        '</div>';
    });

    document.getElementById('v2ResEspacios').innerHTML = html;

    var subtotal = totalRenta + totalMontaje;
    var iva = Math.round(subtotal * 0.16);
    var total = subtotal + iva;

    document.getElementById('v2TotRenta').textContent = formatMXN(totalRenta);
    document.getElementById('v2TotMontaje').textContent = totalMontaje > 0 ? formatMXN(totalMontaje) : '\u2014';
    document.getElementById('v2TotSub').textContent = formatMXN(subtotal);
    document.getElementById('v2TotIva').textContent = formatMXN(iva);
    document.getElementById('v2GrandTotal').textContent = formatMXN(total);
    document.getElementById('v2GrandSub').textContent = formatMXN(subtotal);
  }

  /* ── RECOLECTAR DATOS ── */
  function collectFormData() {
    var ids = Object.keys(selected);
    var espaciosArr = [];
    var totalRenta = 0;
    var totalMontaje = 0;

    ids.forEach(function (id) {
      var sp = SPACES.find(function (s) { return s.id === id; });
      var rentaEspacio = calcSpaceRenta(sp) || 0;
      var montUnit = getMontajeUnit(sp);
      var montDays = selected[id].montajeDays || 0;
      var montTotal = montUnit * montDays;
      var spBd = getSpaceDaysBreakdown(sp);

      totalRenta += rentaEspacio;
      totalMontaje += montTotal;

      espaciosArr.push({
        id: sp.id, name: sp.name, color: sp.color,
        diasRegular: spBd.regular,
        diasWeekend: spBd.weekend,
        diasTotal: spBd.total,
        eventDays: selected[id].eventDays || [],
        precioRegular: sp.priv ? sp.priv.regular : null,
        precioWeekend: sp.priv ? (sp.priv.weekend ?? sp.priv.regular) : null,
        eventoTotal: rentaEspacio,
        montajeDias: montDays,
        montajeTotal: montTotal,
      });
    });

    var subtotal = totalRenta + totalMontaje;
    var iva = Math.round(subtotal * 0.16);
    var total = subtotal + iva;

    return {
      cliente:      document.getElementById('v2Cliente').value.trim(),
      agencia:      document.getElementById('v2Agencia').value.trim(),
      evento:       document.getElementById('v2Evento').value.trim(),
      contacto:     document.getElementById('v2Contacto').value.trim(),
      telefono:     document.getElementById('v2Telefono').value.trim(),
      correo:       document.getElementById('v2Correo').value.trim(),
      fechaInicio:  '', // Task 3 adaptará fechas por venue
      fechaFin:     '',
      asistentes:   document.getElementById('v2Asistentes').value.trim(),
      descripcion:  document.getElementById('v2Descripcion').value.trim(),
      horaInicio:   document.getElementById('v2HoraInicio').value,
      horaFin:      document.getElementById('v2HoraFin').value,
      tipoEvento:   tipo,
      diasRegular:  0,
      diasWeekend:  0,
      diasTotal:    0,
      espacios:     JSON.stringify(espaciosArr),
      espaciosArr:  espaciosArr,
      rentaTotal:   totalRenta,
      montajeTotal: totalMontaje,
      subtotal:     subtotal,
      iva:          iva,
      total:        total,
    };
  }

  /* ── ENVIAR ── */
  function enviarCotizacion() {
    var folio = generateFolio();
    currentFolio = folio;
    var payload = collectFormData();
    payload.folio = folio;
    var serverPayload = Object.assign({}, payload);
    delete serverPayload.espaciosArr;

    var btn = document.getElementById('v2CtaBtn');
    btn.disabled = true;
    btn.textContent = 'ENVIANDO...';
    btn.classList.add('v2-cta-btn--sending');
    var folioEl = document.getElementById('v2Folio');

    // Generar PDF y extraer base64 para enviar al servidor
    var pdfBase64 = '';
    try {
      var pdfDoc = generarPDFDoc(payload);
      pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
    } catch (pdfErr) {}
    if (pdfBase64) serverPayload.pdfBase64 = pdfBase64;

    if (!APPS_SCRIPT_URL) {
      setTimeout(function () { onEnvioExitoso(btn, folioEl, folio); }, 1500);
      return;
    }

    fetch(APPS_SCRIPT_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(serverPayload),
    })
    .then(function (res) { return res.json(); })
    .then(function (result) {
      if (result.status === 'error') throw new Error(result.message);
      onEnvioExitoso(btn, folioEl, folio);
    })
    .catch(function (err) {
      btn.textContent = 'ERROR \u2014 REINTENTAR';
      btn.disabled = false;
      btn.classList.remove('v2-cta-btn--sending');
      cotizacionEnviada = false;
    });
  }

  function onEnvioExitoso(btn, folioEl, folio) {
    btn.textContent = 'DESCARGAR COTIZACI\u00D3N';
    btn.disabled = false;
    btn.classList.remove('v2-cta-btn--sending');
    btn.classList.add('v2-cta-btn--download');
    cotizacionEnviada = true;
    if (folioEl) { folioEl.textContent = 'FOLIO: ' + folio; folioEl.classList.add('visible'); }
  }

  /* ── PDF ── */
  function generarPDFDoc(data) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'a4' });
    var W = 210, H = 297, margin = 20, contentW = W - margin * 2, y = 0;

    var HEADER_H = 22;    // altura de la cabecera
    var FOOTER_H = 28;    // altura reservada para pie de página
    var CONTENT_TOP = 30; // y donde empieza el contenido después de cabecera
    var MAX_Y = H - FOOTER_H; // límite antes de pie de página

    // ── Funciones reutilizables para cabecera y pie ──
    function drawHeader() {
      doc.setFillColor(5, 9, 5); doc.rect(0, 0, W, H, 'F');
      doc.setFillColor(7, 15, 9); doc.rect(0, 0, W, HEADER_H, 'F');
      doc.setDrawColor(0, 255, 65); doc.setLineWidth(0.5); doc.line(0, HEADER_H, W, HEADER_H);

      doc.setTextColor(0, 255, 65); doc.setFont('helvetica', 'bold');
      doc.setFontSize(18); doc.text('MUNET', margin, 14);
      doc.setFontSize(8); doc.text('FOLIO: ' + data.folio, W - margin, 10, { align: 'right' });
      doc.setFontSize(6); doc.setTextColor(0, 200, 50);
      doc.text('SIMULADOR DE COSTOS \u00B7 RENTA DE ESPACIOS \u00B7 2026', W - margin, 16, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    function drawFooter() {
      var fy = H - FOOTER_H + 4;
      // Línea separadora
      doc.setDrawColor(0, 255, 65); doc.setLineWidth(0.2);
      doc.line(margin, fy, W - margin, fy);
      fy += 5;

      // Texto de contacto
      doc.setFontSize(6); doc.setTextColor(100, 118, 100);
      doc.text('Av. de los Compositores s/n \u00B7 Bosque de Chapultepec 2\u00AA Secc. \u00B7 CDMX', margin, fy);
      fy += 3.5;
      doc.text('contacto@museomunet.com \u00B7 museomunet.com \u00B7 Precios + IVA \u00B7 Vigentes 2026', margin, fy);

      // Logo BUNKER (alineado a la derecha)
      if (typeof BUNKER_LOGO_B64 !== 'undefined') {
        var logoW = 30, logoH = 11; // proporción 150:54
        doc.addImage(BUNKER_LOGO_B64, 'PNG', W - margin - logoW, H - FOOTER_H + 6, logoW, logoH);
      }

      // Número de página
      var pageNum = doc.internal.getNumberOfPages();
      doc.setFontSize(7); doc.setTextColor(0, 200, 50);
      doc.text('P\u00C1G ' + doc.internal.getCurrentPageInfo().pageNumber + '/' + pageNum, W / 2, H - 6, { align: 'center' });
    }

    function checkPage(needed) {
      if (y + needed > MAX_Y) {
        doc.addPage();
        drawHeader();
        y = CONTENT_TOP;
      }
    }

    // ── Página 1 ──
    drawHeader();
    y = CONTENT_TOP;

    doc.setFontSize(22); doc.setTextColor(237, 248, 237); doc.text('TU COTIZACI\u00D3N', margin, y); y += 6;
    doc.setFontSize(7); doc.setTextColor(0, 255, 65); doc.text('MUNET \u00B7 RENTA DE ESPACIOS \u00B7 2026', margin, y); y += 10;

    // Client box — calcular altura dinámica
    var boxRows = 5; // cliente, contacto, tel/correo, fechas, días (fijos)
    if (data.agencia) boxRows++;
    if (data.evento) boxRows++;
    if (data.horaInicio || data.horaFin) boxRows++;
    if (data.descripcion) boxRows++;
    var boxH = 8 + (boxRows * 6); // padding top + filas

    doc.setFillColor(7, 15, 9); doc.rect(margin, y, contentW, boxH, 'F');
    doc.setDrawColor(0, 255, 65); doc.setLineWidth(0.2); doc.rect(margin, y, contentW, boxH, 'S');

    var cy = y + 7, labelX = margin + 5, valX = margin + 40;

    doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('CLIENTE', labelX, cy);
    doc.setFontSize(9); doc.setTextColor(237, 248, 237); doc.text(data.cliente || '\u2014', valX, cy); cy += 6;

    if (data.agencia) {
      doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('AGENCIA', labelX, cy);
      doc.setFontSize(9); doc.setTextColor(237, 248, 237); doc.text(data.agencia, valX, cy); cy += 6;
    }

    if (data.evento) {
      doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('EVENTO', labelX, cy);
      doc.setFontSize(9); doc.setTextColor(237, 248, 237); doc.text(data.evento, valX, cy); cy += 6;
    }

    doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('CONTACTO', labelX, cy);
    doc.setFontSize(9); doc.setTextColor(237, 248, 237); doc.text(data.contacto || '\u2014', valX, cy); cy += 6;

    var telCorreo = [data.telefono, data.correo].filter(function(v){return v;}).join(' \u00B7 ');
    doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('TEL / CORREO', labelX, cy);
    doc.setFontSize(9); doc.setTextColor(237, 248, 237); doc.text(telCorreo || '\u2014', valX, cy); cy += 6;

    var fechaDisplay = formatFecha(data.fechaInicio) || '\u2014';
    if (data.fechaFin && data.fechaFin !== data.fechaInicio) fechaDisplay += ' \u2014 ' + formatFecha(data.fechaFin);
    doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('FECHAS EVENTO', labelX, cy);
    doc.setFontSize(9); doc.setTextColor(237, 248, 237); doc.text(fechaDisplay, valX, cy); cy += 6;

    // Desglose de días
    var diasText = data.diasTotal + ' d\u00EDa' + (data.diasTotal > 1 ? 's' : '');
    if (data.diasRegular > 0 && data.diasWeekend > 0) {
      diasText += ' (' + data.diasRegular + ' LUN-JUE + ' + data.diasWeekend + ' VIE-S\u00C1B)';
    }
    doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('D\u00CDAS', labelX, cy);
    doc.setFontSize(9); doc.setTextColor(237, 248, 237); doc.text(diasText, valX, cy);

    var tipoText = data.tipoEvento === 'privado' ? 'EVENTO PRIVADO' : 'EVENTO P\u00DABLICO';
    doc.setFontSize(7); doc.setTextColor(0, 200, 50);
    doc.text(tipoText, W - margin, cy, { align: 'right' });
    cy += 6;

    if (data.horaInicio || data.horaFin) {
      var horarioText = (data.horaInicio || '\u2014') + ' \u2014 ' + (data.horaFin || '\u2014');
      doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('HORARIO', labelX, cy);
      doc.setFontSize(9); doc.setTextColor(237, 248, 237); doc.text(horarioText, valX, cy); cy += 6;
    }

    if (data.descripcion) {
      doc.setFontSize(6); doc.setTextColor(0, 200, 50); doc.text('DESCRIPCI\u00D3N', labelX, cy);
      doc.setFontSize(8); doc.setTextColor(237, 248, 237);
      var descLines = doc.splitTextToSize(data.descripcion, contentW - 45);
      doc.text(descLines[0], valX, cy); cy += 6;
    }

    y += boxH + 8;

    // Espacios
    doc.setFontSize(7); doc.setTextColor(0, 255, 65);
    doc.text('\u2014 ESPACIOS SELECCIONADOS', margin, y); y += 6;

    data.espaciosArr.forEach(function (esp) {
      checkPage(25); // cada espacio necesita ~25mm mínimo
      var rgb = hexToRGB(esp.color);

      doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(0.8); doc.line(margin, y, margin + 2, y);
      doc.setFontSize(13); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(esp.name, margin + 5, y + 1);
      var espAmountText = formatMXN(esp.eventoTotal + esp.montajeTotal);
      doc.text(espAmountText, W - margin, y + 1, { align: 'right' });
      y += 5;

      // Días de este venue
      var espDiasTotal = esp.diasRegular + esp.diasWeekend;
      var espDiasLabel = espDiasTotal + ' d\u00EDa' + (espDiasTotal > 1 ? 's' : '');
      if (esp.diasRegular > 0 && esp.diasWeekend > 0) {
        espDiasLabel += ' (' + esp.diasRegular + ' LUN-JUE + ' + esp.diasWeekend + ' VIE-S\u00C1B)';
      } else if (esp.diasWeekend > 0) {
        espDiasLabel += ' (VIE-S\u00C1B)';
      } else {
        espDiasLabel += ' (LUN-JUE)';
      }
      doc.setFontSize(7); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(espDiasLabel, margin + 5, y);
      y += 4;

      // Desglose por tipo de día
      if (data.tipoEvento === 'privado') {
        if (esp.precioRegular !== null && esp.diasRegular > 0) {
          doc.setFontSize(7); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          doc.text(esp.diasRegular + ' d\u00EDa' + (esp.diasRegular > 1 ? 's' : '') + ' LUN-JUE \u00B7 ' + formatMXN(esp.precioRegular) + '/d\u00EDa \u00B7 ' + formatMXN(esp.diasRegular * esp.precioRegular), margin + 5, y);
          y += 4;
        }
        if (esp.precioWeekend !== null && esp.diasWeekend > 0) {
          doc.setFontSize(7); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          doc.text(esp.diasWeekend + ' d\u00EDa' + (esp.diasWeekend > 1 ? 's' : '') + ' VIE-S\u00C1B \u00B7 ' + formatMXN(esp.precioWeekend) + '/d\u00EDa \u00B7 ' + formatMXN(esp.diasWeekend * esp.precioWeekend), margin + 5, y);
          y += 4;
        }
      } else if (data.tipoEvento === 'publico' && esp.precioRegular !== null) {
        if (esp.diasRegular > 0) {
          doc.setFontSize(7); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          doc.text(esp.diasRegular + ' d\u00EDa' + (esp.diasRegular > 1 ? 's' : '') + ' LUN-JUE \u00B7 ' + formatMXN(esp.precioRegular) + '/d\u00EDa \u00B7 ' + formatMXN(esp.diasRegular * esp.precioRegular), margin + 5, y);
          y += 4;
        }
        if (esp.precioWeekend !== null && esp.diasWeekend > 0) {
          doc.setFontSize(7); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
          doc.text(esp.diasWeekend + ' d\u00EDa' + (esp.diasWeekend > 1 ? 's' : '') + ' VIE-S\u00C1B \u00B7 ' + formatMXN(esp.precioWeekend) + '/d\u00EDa \u00B7 ' + formatMXN(esp.diasWeekend * esp.precioWeekend), margin + 5, y);
          y += 4;
        }
      }
      if (esp.montajeDias > 0) {
        doc.setFontSize(7); doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text('+ ' + esp.montajeDias + ' d\u00EDa' + (esp.montajeDias > 1 ? 's' : '') + ' montaje \u00B7 ' + formatMXN(esp.montajeTotal), margin + 5, y);
        y += 4;
      }
      y += 4;
    });

    // Totales
    checkPage(45);
    y += 3;
    doc.setDrawColor(0, 255, 65); doc.setLineWidth(0.3); doc.line(margin, y, W - margin, y); y += 8;

    doc.setFontSize(7); doc.setTextColor(200, 236, 200);
    doc.text('RENTA DE ESPACIOS', margin, y); doc.text(formatMXN(data.rentaTotal), W - margin, y, { align: 'right' }); y += 5;
    if (data.montajeTotal > 0) {
      doc.text('D\u00CDAS DE MONTAJE', margin, y); doc.text(formatMXN(data.montajeTotal), W - margin, y, { align: 'right' }); y += 5;
    }
    doc.setDrawColor(0, 255, 65); doc.setLineWidth(0.1); doc.line(margin, y, W - margin, y); y += 5;
    doc.text('SUBTOTAL S/IVA', margin, y); doc.setFontSize(10); doc.text(formatMXN(data.subtotal), W - margin, y, { align: 'right' }); y += 5;
    doc.setFontSize(7); doc.text('IVA (16%)', margin, y); doc.setFontSize(10); doc.text(formatMXN(data.iva), W - margin, y, { align: 'right' }); y += 8;

    doc.setFillColor(0, 255, 65); doc.rect(margin, y - 2, contentW, 14, 'F');
    doc.setFontSize(7); doc.setTextColor(5, 9, 5); doc.text('TOTAL ESTIMADO CON IVA', margin + 5, y + 3);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text(formatMXN(data.total), W - margin - 5, y + 9, { align: 'right' });
    doc.setFont('helvetica', 'normal');

    // ── Dibujar pie de página en TODAS las páginas ──
    var totalPages = doc.internal.getNumberOfPages();
    for (var p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      drawFooter();
    }

    return doc;
  }

  function descargarPDF() {
    if (!window.jspdf) { alert('Error: la librer\u00EDa de PDF no se carg\u00F3.'); return; }
    var data = collectFormData();
    data.folio = currentFolio;
    var doc = generarPDFDoc(data);
    doc.save('Cotizacion-MUNET-' + currentFolio + '.pdf');
  }

  /* ── CTA HANDLER ── */
  function handleCtaClick() {
    if (!cotizacionEnviada) enviarCotizacion();
    else descargarPDF();
  }

  /* ── CURSOR ── */
  function initCursor() {
    var cur = document.getElementById('cur');
    var curR = document.getElementById('curR');
    if (!cur || !curR) return;
    if (window.matchMedia('(max-width:1024px)').matches) return;
    document.addEventListener('mousemove', function (e) {
      cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px';
      curR.style.left = e.clientX + 'px'; curR.style.top = e.clientY + 'px';
    });
  }

  /* ── INIT ── */
  document.addEventListener('DOMContentLoaded', function () {
    // Step 1 validation
    ['v2Cliente', 'v2Agencia', 'v2Evento', 'v2Contacto', 'v2Telefono', 'v2Correo', 'v2Asistentes'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) { el.addEventListener('input', validateStep1); el.addEventListener('change', validateStep1); }
    });

    // Next buttons
    document.getElementById('btnNext1').addEventListener('click', function () { if (isStep1Valid()) goToStep(2); });
    document.getElementById('btnNext2').addEventListener('click', function () { goToStep(3); });
    document.getElementById('btnNext3').addEventListener('click', function () { if (hasSpacesSelected()) goToStep(4); });

    // Tipo
    document.querySelectorAll('.v2-tipo-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setTipo(btn.getAttribute('data-tipo'), btn); });
    });

    // CTA
    document.getElementById('v2CtaBtn').addEventListener('click', handleCtaClick);

    // Reabrir pasos completados
    document.querySelectorAll('.v2-step-header').forEach(function (hdr) {
      hdr.addEventListener('click', function () {
        var stepEl = hdr.closest('.v2-step');
        if (stepEl.classList.contains('v2-step--done')) {
          goToStep(parseInt(hdr.getAttribute('data-step'), 10));
        }
      });
    });

    initCursor();
  });

})();
