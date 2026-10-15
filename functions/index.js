// firebase-functions v6 movió la API v2 a la raíz del paquete, así que la v1
// (la que usa esta función: onCall(data, context)) se importa explícitamente.
// Migrar a v2 implicaría borrar y recrear la función y revisar la CSP del
// panel, porque cambia la URL; no vale la pena solo por el cambio de runtime.
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
admin.initializeApp();

exports.createUser = functions.https.onCall(async (data, context) => {
  // Solo admin puede crear usuarios
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'No autenticado');

  const callerDoc = await admin.firestore().collection('usuarios').doc(context.auth.uid).get();
  if (!callerDoc.exists || callerDoc.data().rol !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Solo admin puede crear usuarios');
  }

  const { email, password, nombre, rol } = data;
  if (!email || !password || !nombre || !rol) {
    throw new functions.https.HttpsError('invalid-argument', 'Faltan campos requeridos');
  }

  const rolesPermitidos = ['admin', 'ventas', 'produccion', 'lectura'];
  if (!rolesPermitidos.includes(rol)) {
    throw new functions.https.HttpsError('invalid-argument', 'Rol inválido. Permitidos: ' + rolesPermitidos.join(', '));
  }

  // Crear usuario en Firebase Auth
  const userRecord = await admin.auth().createUser({
    email: email,
    password: password,
    displayName: nombre
  });

  // Crear documento en Firestore
  await admin.firestore().collection('usuarios').doc(userRecord.uid).set({
    nombre: nombre,
    email: email,
    rol: rol,
    activo: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { uid: userRecord.uid, success: true };
});
