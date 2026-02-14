import 'dotenv/config';

console.log('Current Directory:', process.cwd());
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID ? 'MATCH FOUND' : 'MISSING');
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL ? 'MATCH FOUND' : 'MISSING');
console.log('FIREBASE_PRIVATE_KEY:', process.env.FIREBASE_PRIVATE_KEY ? 'MATCH FOUND' : 'MISSING');

if (process.env.FIREBASE_PRIVATE_KEY) {
    console.log('Private Key Length:', process.env.FIREBASE_PRIVATE_KEY.length);
    console.log('Starts with -----BEGIN:', process.env.FIREBASE_PRIVATE_KEY.trim().startsWith('-----BEGIN'));
}
