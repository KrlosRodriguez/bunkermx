// firebase-config.js — Inicialización Firebase para panel BUNKER
(function () {
  'use strict';

  var firebaseConfig = {
    apiKey: "AIzaSyC3AyQM53esGmybpge5lEub-Ezd7f74jdE",
    authDomain: "bunker-panel.firebaseapp.com",
    projectId: "bunker-panel",
    storageBucket: "bunker-panel.firebasestorage.app",
    messagingSenderId: "1053003957611",
    appId: "1:1053003957611:web:a918a8fa3f7a10e2e6782e"
  };

  // Inicializar Firebase
  firebase.initializeApp(firebaseConfig);

  // App Check (reCAPTCHA v3) — reemplazar con site key real después de configurar en consola Firebase
  var appCheck = firebase.appCheck();
  appCheck.activate('RECAPTCHA_SITE_KEY_PENDIENTE', true);

  // Exponer instancias para todos los módulos
  window.BNK_FIREBASE = {
    app: firebase.app(),
    auth: firebase.auth(),
    db: firebase.firestore(),
    storage: firebase.storage()
  };

  // Persistencia de sesión — expira al cerrar pestaña/navegador
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION);
})();
