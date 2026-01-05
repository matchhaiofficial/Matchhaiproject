import * as auth from 'firebase/auth';

console.log('firebase/auth exports:', Object.keys(auth));

try {
    const { getReactNativePersistence } = auth;
    console.log('getReactNativePersistence in firebase/auth:', !!getReactNativePersistence);
} catch (e) {
    console.log('Error checking getReactNativePersistence', e);
}
