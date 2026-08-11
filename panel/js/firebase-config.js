// firebase-config.js — Inicialización Firebase para panel BUNKER
(function () {
  'use strict';

  var firebaseConfig = {
    apiKey: "AIzaSyB5l2OPtDIo2tiaUqeVWsUady_OyIAHPVY",
    authDomain: "bunker-panel-3a352.firebaseapp.com",
    projectId: "bunker-panel-3a352",
    storageBucket: "bunker-panel-3a352.firebasestorage.app",
    messagingSenderId: "503014259933",
    appId: "1:503014259933:web:5fb4866112bcce0fa4af34"
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
