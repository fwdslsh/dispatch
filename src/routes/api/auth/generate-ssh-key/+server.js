import { json } from '@sveltejs/kit';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import crypto from 'crypto';

export async function POST({ request }) {
	try {
		const { name = 'Default Key', type = 'ed25519' } = await request.json();

		// Validate key type
		if (!['rsa', 'ed25519', 'ecdsa'].includes(type)) {
			return json({ error: 'Invalid key type' }, { status: 400 });
		}

		// Create temporary directory for key generation
		const tempDir = join(tmpdir(), `ssh-keygen-${crypto.randomUUID()}`);
		await fs.mkdir(tempDir, { recursive: true });

		const keyPath = join(tempDir, 'id_key');
		
		try {
			// Generate SSH key pair
			const keygenArgs = [
				'-t', type,
				'-f', keyPath,
				'-N', '', // No passphrase
				'-C', `${name}@dispatch-server`
			];

			// For RSA keys, use 4096 bits for better security
			if (type === 'rsa') {
				keygenArgs.splice(2, 0, '-b', '4096');
			}

			const result = await new Promise((resolve, reject) => {
				const process = spawn('ssh-keygen', keygenArgs);
				
				let stdout = '';
				let stderr = '';
				
				process.stdout.on('data', (data) => {
					stdout += data.toString();
				});
				
				process.stderr.on('data', (data) => {
					stderr += data.toString();
				});
				
				process.on('close', (code) => {
					if (code === 0) {
						resolve({ stdout, stderr });
					} else {
						reject(new Error(`ssh-keygen failed with code ${code}: ${stderr}`));
					}
				});
				
				process.on('error', (error) => {
					reject(error);
				});
			});

			// Read the generated keys
			const privateKey = await fs.readFile(keyPath, 'utf8');
			const publicKey = await fs.readFile(`${keyPath}.pub`, 'utf8');

			// Clean up temporary files
			await fs.unlink(keyPath).catch(() => {});
			await fs.unlink(`${keyPath}.pub`).catch(() => {});
			await fs.rmdir(tempDir).catch(() => {});

			return json({
				success: true,
				privateKey,
				publicKey: publicKey.trim(),
				fingerprint: await generateFingerprint(publicKey),
				keyType: type
			});

		} catch (error) {
			// Clean up on error
			await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
			throw error;
		}

	} catch (error) {
		console.error('SSH key generation error:', error);
		return json({ 
			error: error.message || 'Failed to generate SSH key pair' 
		}, { status: 500 });
	}
}

async function generateFingerprint(publicKey) {
	// Simple SHA256 fingerprint for the public key
	const hash = crypto.createHash('sha256');
	hash.update(publicKey);
	return hash.digest('hex').slice(0, 16);
}