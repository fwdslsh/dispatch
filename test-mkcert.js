const mkcert = require('mkcert');
const fs = require('fs');

async function testMkcert() {
  try {
    console.log('Testing mkcert...');
    
    // Simple approach - just create cert directly
    const cert = await mkcert.createCert({
      domains: ['localhost', '127.0.0.1'],
      validityDays: 365
    });
    
    console.log('Direct cert creation result keys:', Object.keys(cert));
    console.log('Has cert:', !!cert.cert);
    console.log('Has key:', !!cert.key);
    
    if (cert.cert && cert.key) {
      fs.writeFileSync('/tmp/test-cert.pem', cert.cert);
      fs.writeFileSync('/tmp/test-key.pem', cert.key);
      console.log('Test certificates written to /tmp/');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testMkcert();
