// Firebase-Zugang (öffentliche Kennung der Web-App, kein Geheimnis: den Schutz leisten die Regeln in firestore.rules).
// Steht hier null, arbeitet die App rein lokal.
export const firebaseConfig = {
  apiKey: 'AIzaSyACPxrMMDCxdS5Gd7cA7Wtnyfd0BTm3hwo',
  authDomain: 'board-7d021.firebaseapp.com',
  projectId: 'board-7d021',
  storageBucket: 'board-7d021.firebasestorage.app',
  messagingSenderId: '583281306856',
  appId: '1:583281306856:web:3721e9c0a5dad2c77c2d5d',
  google: false, // Anmeldung mit Google, erst nach Einrichtung in der Firebase-Konsole auf true setzen
};
