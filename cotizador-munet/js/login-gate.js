(function(){
  var KEY = 'bnk_cot_auth';
  var P = 'sV2ctmnt';
  var USERS = ['BK-01','BK-02','BK-03','BK-04','BK-05','BK-06','BK-07','BK-08','BK-09','BK-10'];

  if(sessionStorage.getItem(KEY) === 'granted') return;

  var hideStyle = document.createElement('style');
  hideStyle.id = 'lg-hide';
  hideStyle.textContent = 'body{visibility:hidden!important;overflow:hidden!important;}#login-gate,#login-gate *{visibility:visible!important;}';
  document.head.appendChild(hideStyle);

  document.addEventListener('DOMContentLoaded', function(){

    var ov = document.createElement('div');
    ov.id = 'login-gate';
    ov.innerHTML = [
      '<div class="lg-box">',
      '  <div class="lg-logo"><img src="../img/logo-munet.webp" alt="MUNET"></div>',
      '  <div class="lg-tag">SIMULADOR DE COSTOS — ACCESO RESTRINGIDO</div>',
      '  <form id="lg-form" autocomplete="off">',
      '    <div class="lg-field">',
      '      <label>USUARIO</label>',
      '      <input type="text" id="lg-user" autocomplete="off" spellcheck="false" placeholder="BK-00">',
      '    </div>',
      '    <div class="lg-field">',
      '      <label>CONTRASEÑA</label>',
      '      <input type="password" id="lg-pass" autocomplete="off">',
      '    </div>',
      '    <div class="lg-error" id="lg-error"></div>',
      '    <button type="submit" class="lg-btn">INGRESAR AL SISTEMA</button>',
      '  </form>',
      '  <div class="lg-footer">BUNKER CREATIVIDAD EMPRESARIAL &copy; 2026</div>',
      '</div>'
    ].join('\n');

    var st = document.createElement('style');
    st.textContent = [
      '#login-gate{position:fixed;inset:0;z-index:999999;display:flex;align-items:center;justify-content:center;',
      'background:#0a0a0a;font-family:"Barlow Condensed",sans-serif;}',
      '.lg-box{width:90%;max-width:400px;text-align:center;padding:3rem 2rem;',
      'border:1px solid rgba(198,163,80,.3);background:rgba(15,15,15,.95);}',
      '.lg-logo img{height:50px;margin-bottom:1.5rem;opacity:.8;}',
      '.lg-tag{font-size:.75rem;letter-spacing:3px;color:rgba(198,163,80,.7);margin-bottom:2.5rem;font-family:"Space Mono",monospace;}',
      '.lg-field{text-align:left;margin-bottom:1.2rem;}',
      '.lg-field label{display:block;font-size:.7rem;letter-spacing:2px;color:rgba(255,255,255,.4);margin-bottom:.4rem;font-family:"Space Mono",monospace;}',
      '.lg-field input{width:100%;padding:.7rem .8rem;background:rgba(255,255,255,.05);border:1px solid rgba(198,163,80,.2);',
      'color:#fff;font-family:"Barlow",sans-serif;font-size:1rem;outline:none;box-sizing:border-box;transition:border-color .3s;}',
      '.lg-field input:focus{border-color:rgba(198,163,80,.6);}',
      '.lg-error{color:#e74c3c;font-size:.8rem;min-height:1.2rem;margin-bottom:.5rem;}',
      '.lg-btn{width:100%;padding:.8rem;background:transparent;border:1px solid rgba(198,163,80,.5);color:rgba(198,163,80,1);',
      'font-family:"Barlow Condensed",sans-serif;font-size:1rem;letter-spacing:2px;cursor:pointer;transition:all .3s;text-transform:uppercase;}',
      '.lg-btn:hover{background:rgba(198,163,80,.15);border-color:rgba(198,163,80,.8);}',
      '.lg-footer{margin-top:2rem;font-size:.65rem;letter-spacing:2px;color:rgba(255,255,255,.2);font-family:"Space Mono",monospace;}'
    ].join('\n');

    document.head.appendChild(st);
    document.body.appendChild(ov);
    ov.style.visibility = 'visible';

    document.getElementById('lg-user').focus();

    document.getElementById('lg-form').addEventListener('submit', function(e){
      e.preventDefault();
      var u = document.getElementById('lg-user').value.trim().toUpperCase();
      var p = document.getElementById('lg-pass').value;
      if(USERS.indexOf(u) !== -1 && p === P){
        sessionStorage.setItem(KEY, 'granted');
        ov.remove();
        st.remove();
        hideStyle.remove();
      } else {
        document.getElementById('lg-error').textContent = '> ACCESO DENEGADO — Credenciales incorrectas';
        document.getElementById('lg-pass').value = '';
        document.getElementById('lg-pass').focus();
      }
    });
  });
})();
