import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    // Uses GOOGLE_APPLICATION_CREDENTIALS env var for service account
    credential: admin.credential.applicationDefault(),
    databaseURL: "https://projektinzynierski-44c9d-default-rtdb.europe-west1.firebasedatabase.app"
  });
}

export default admin;