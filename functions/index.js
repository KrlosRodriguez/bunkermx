const functions = require('firebase-functions');
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
