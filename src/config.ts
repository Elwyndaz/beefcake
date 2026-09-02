/**
 * Publika Firebase-identifierare för inloggningen, ingen hemlighet: de ligger i varje
 * klient. Tomt projectId betyder att inloggningen inte är konfigurerad (lokal utveckling
 * utan moln går ändå). Fylls i när Beefcakes eget Firebase-projekt finns.
 */
export const FIREBASE = {
  apiKey: '',
  authDomain: '',
  projectId: ''
}
