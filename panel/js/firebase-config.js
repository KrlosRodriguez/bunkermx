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

  // Exponer instancias para todos los módulos
  window.BNK_FIREBASE = {
    app: firebase.app(),
    auth: firebase.auth(),
    db: firebase.firestore()
  };

  // Persistencia de sesión — se mantiene al cerrar pestaña
  firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
})();
