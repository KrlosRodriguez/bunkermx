// firestore.js — Capa de acceso a datos Firestore para panel BUNKER
(function () {
  'use strict';

  var db = BNK_FIREBASE.db;

  // ── Factory de colección ──
  function collectionAPI(name, options) {
    options = options || {};
    var defaultOrder = options.orderBy || null;

    return {
      list: function (filters) {
        var ref = db.collection(name);
        if (filters) {
          Object.keys(filters).forEach(function (key) {
            ref = ref.where(key, '==', filters[key]);
          });
        }
        if (defaultOrder) ref = ref.orderBy(defaultOrder.field, defaultOrder.dir || 'asc');
        return ref.get().then(function (snap) {
          return snap.docs.map(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            return d;
          });
        });
      },

      get: function (id) {
        return db.collection(name).doc(id).get().then(function (doc) {
          if (!doc.exists) return null;
          var d = doc.data();
          d.id = doc.id;
          return d;
        });
      },

      create: function (data) {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        return db.collection(name).add(data).then(function (ref) {
          data.id = ref.id;
          return data;
        });
      },

      update: function (id, data) {
        data.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        return db.collection(name).doc(id).update(data);
      },

      delete: function (id) {
        return db.collection(name).doc(id).delete();
      },

      onSnapshot: function (callback, filters) {
        var ref = db.collection(name);
        if (filters) {
          Object.keys(filters).forEach(function (key) {
            ref = ref.where(key, '==', filters[key]);
          });
        }
        if (defaultOrder) ref = ref.orderBy(defaultOrder.field, defaultOrder.dir || 'asc');
        return ref.onSnapshot(function (snap) {
          var docs = snap.docs.map(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            return d;
          });
          callback(docs);
        });
      }
    };
  }

  // ── Actividad (subcollection de cotizaciones) ──
  var actividadAPI = {
    add: function (cotizacionId, entry) {
      entry.fecha = firebase.firestore.FieldValue.serverTimestamp();
      return db.collection('cotizaciones').doc(cotizacionId)
        .collection('actividad').add(entry);
    },
    list: function (cotizacionId) {
      return db.collection('cotizaciones').doc(cotizacionId)
        .collection('actividad').orderBy('fecha', 'desc').get()
        .then(function (snap) {
          return snap.docs.map(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            return d;
          });
        });
    }
  };

  // ── Tareas de evento (subcollection de eventos) ──
  var tareasAPI = {
    add: function (eventoId, tarea) {
      return db.collection('eventos').doc(eventoId)
        .collection('tareas').add(tarea);
    },
    list: function (eventoId) {
      return db.collection('eventos').doc(eventoId)
        .collection('tareas').orderBy('orden', 'asc').get()
        .then(function (snap) {
          return snap.docs.map(function (doc) {
            var d = doc.data();
            d.id = doc.id;
            return d;
          });
        });
    },
    update: function (eventoId, tareaId, data) {
      return db.collection('eventos').doc(eventoId)
        .collection('tareas').doc(tareaId).update(data);
    }
  };

  // ── API pública ──
  window.BNK_DB = {
    cotizaciones:        collectionAPI('cotizaciones', { orderBy: { field: 'fecha', dir: 'desc' } }),
    clientes:            collectionAPI('clientes', { orderBy: { field: 'razonSocial', dir: 'asc' } }),
    proveedores:         collectionAPI('proveedores', { orderBy: { field: 'razonSocial', dir: 'asc' } }),
    catalogo:            collectionAPI('catalogo', { orderBy: { field: 'categoria', dir: 'asc' } }),
    usuarios:            collectionAPI('usuarios', { orderBy: { field: 'nombre', dir: 'asc' } }),
    eventos:             collectionAPI('eventos', { orderBy: { field: 'fechaEvento', dir: 'asc' } }),
    plantillas:          collectionAPI('plantillas'),
    config:              collectionAPI('config'),
    partners:            collectionAPI('partners', { orderBy: { field: 'nombre', dir: 'asc' } }),
    pagos:               collectionAPI('pagos', { orderBy: { field: 'createdAt', dir: 'desc' } }),
    cotizacionPartners:  collectionAPI('cotizacionPartners'),
    actividad:           actividadAPI,
    tareas:              tareasAPI
  };
})();
