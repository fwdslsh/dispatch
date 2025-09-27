import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './logger.js';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SSL Certificate Management for Dispatch
 * Uses node-forge to generate self-signed certificates for development
 */

const CERT_DIR = path.join(process.cwd(), '.dispatch-ssl');
const CERT_FILE = path.join(CERT_DIR, 'localhost.pem');
const KEY_FILE = path.join(CERT_DIR, 'localhost-key.pem');

/**
 * Check if SSL certificates exist and are valid
 */
export function certificatesExist() {
	return fs.existsSync(CERT_FILE) && fs.existsSync(KEY_FILE);
}

/**
 * Generate SSL certificates using node-forge
 */
export async function generateCertificates() {
	try {
		// Create certificate directory if it doesn't exist
		if (!fs.existsSync(CERT_DIR)) {
			fs.mkdirSync(CERT_DIR, { recursive: true });
		}

		logger.info('SSL_CERTS', 'Generating SSL certificates with node-forge...');

		const forge = require('node-forge');
		const { pki } = forge;

		// Generate a key pair
		logger.info('SSL_CERTS', 'Generating RSA key pair...');
		const keys = pki.rsa.generateKeyPair(2048);

		// Create a certificate
		logger.info('SSL_CERTS', 'Creating self-signed certificate...');
		const cert = pki.createCertificate();

		cert.publicKey = keys.publicKey;
		cert.serialNumber = '01';
		cert.validity.notBefore = new Date();
		cert.validity.notAfter = new Date();
		cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

		// Set certificate subject and issuer
		const attrs = [
			{ name: 'commonName', value: 'localhost' },
			{ name: 'countryName', value: 'US' },
			{ shortName: 'ST', value: 'CA' },
			{ name: 'localityName', value: 'San Francisco' },
			{ name: 'organizationName', value: 'Dispatch Development' },
			{ shortName: 'OU', value: 'IT Department' }
		];

		cert.setSubject(attrs);
		cert.setIssuer(attrs);

		// Add extensions
		cert.setExtensions([
			{
				name: 'basicConstraints',
				cA: true
			},
			{
				name: 'keyUsage',
				keyCertSign: true,
				digitalSignature: true,
				nonRepudiation: true,
				keyEncipherment: true,
				dataEncipherment: true
			},
			{
				name: 'extKeyUsage',
				serverAuth: true,
				clientAuth: true,
				codeSigning: true,
				emailProtection: true,
				timeStamping: true
			},
			{
				name: 'nsCertType',
				client: true,
				server: true,
				email: true,
				objsign: true,
				sslCA: true,
				emailCA: true,
				objCA: true
			},
			{
				name: 'subjectAltName',
				altNames: [
					{
						type: 2, // DNS
						value: 'localhost'
					},
					{
						type: 7, // IP
						ip: '127.0.0.1'
					},
					{
						type: 7, // IP
						ip: '::1'
					}
				]
			}
		]);

		// Self-sign certificate
		cert.sign(keys.privateKey);

		// Convert to PEM format
		const certPem = pki.certificateToPem(cert);
		const keyPem = pki.privateKeyToPem(keys.privateKey);

		// Write certificate and key files
		fs.writeFileSync(CERT_FILE, certPem);
		fs.writeFileSync(KEY_FILE, keyPem);

		// Set appropriate permissions
		fs.chmodSync(KEY_FILE, 0o600);
		fs.chmodSync(CERT_FILE, 0o644);

		logger.info('SSL_CERTS', `SSL certificates generated successfully:`);
		logger.info('SSL_CERTS', `  Certificate: ${CERT_FILE}`);
		logger.info('SSL_CERTS', `  Private Key: ${KEY_FILE}`);

		return {
			cert: certPem,
			key: keyPem,
			certFile: CERT_FILE,
			keyFile: KEY_FILE
		};
	} catch (error) {
		logger.error('SSL_CERTS', 'Failed to generate SSL certificates:', error);
		throw error;
	}
}

/**
 * Get SSL certificate options for HTTPS server
 */
export async function getSSLOptions() {
	if (!certificatesExist()) {
		await generateCertificates();
	}

	try {
		const cert = fs.readFileSync(CERT_FILE, 'utf8');
		const key = fs.readFileSync(KEY_FILE, 'utf8');

		return {
			cert,
			key,
			certFile: CERT_FILE,
			keyFile: KEY_FILE
		};
	} catch (error) {
		logger.error('SSL_CERTS', 'Failed to read SSL certificates:', error);
		throw error;
	}
}

/**
 * Check if we're running in a container environment
 */
export function isContainerEnvironment() {
	return (
		process.env.CONTAINER_ENV === 'true' ||
		process.env.DOCKER_CONTAINER === 'true' ||
		fs.existsSync('/.dockerenv')
	);
}

/**
 * Check if SSL should be enabled based on environment variables
 */
export function shouldEnableSSL() {
	const sslEnabled = process.env.SSL_ENABLED;
	const sslMode = process.env.SSL_MODE;
	const isContainer = isContainerEnvironment();
	const isProduction = process.env.NODE_ENV === 'production';

	// If SSL_MODE is set, use that (new approach)
	if (sslMode !== undefined) {
		// In container mode, SSL is handled by nginx reverse proxy
		// The Node.js app should run HTTP only
		if (isContainer) {
			return false; // nginx handles SSL, app runs HTTP
		}
		// For development, enable SSL only if SSL_MODE is not 'none'
		return sslMode !== 'none';
	}

	// Legacy SSL_ENABLED support
	if (sslEnabled !== undefined) {
		return sslEnabled === 'true' || sslEnabled === '1';
	}

	// Default behavior:
	// - Development (Vite): Enable SSL with self-signed certs (trust warnings OK)
	// - Docker/Container: Disable SSL (nginx reverse proxy handles SSL)
	// - Production (non-container): Disable SSL (expect external SSL termination)
	if (isContainer || isProduction) {
		return false; // Disable SSL in containers/production - use reverse proxy SSL
	}

	return true; // Enable SSL in development with self-signed certificates
}

/**
 * Get SSL configuration for Vite dev server
 */
export async function getViteSSLConfig() {
	if (!shouldEnableSSL()) {
		return false;
	}

	try {
		const sslOptions = await getSSLOptions();
		return {
			cert: sslOptions.cert,
			key: sslOptions.key
		};
	} catch (error) {
		logger.warn('SSL_CERTS', 'Failed to setup SSL for Vite, falling back to HTTP:', error.message);
		return false;
	}
}

/**
 * Print SSL setup instructions for users
 */
export function printSSLInstructions() {
	logger.info('SSL_CERTS', 'SSL certificates have been generated for local development');
	logger.info('SSL_CERTS', '');
	logger.info('SSL_CERTS', 'Your browser may show a security warning on first visit.');
	logger.info('SSL_CERTS', 'This is normal for self-signed certificates.');
	logger.info('SSL_CERTS', '');
	logger.info('SSL_CERTS', 'To trust the certificates in your browser:');
	logger.info('SSL_CERTS', '  1. Visit https://localhost:5173 (or your dev server port)');
	logger.info('SSL_CERTS', '  2. Click "Advanced" when you see the security warning');
	logger.info('SSL_CERTS', '  3. Click "Proceed to localhost (unsafe)"');
	logger.info('SSL_CERTS', '');
	logger.info('SSL_CERTS', 'To disable SSL, set SSL_ENABLED=false in your environment');
}
