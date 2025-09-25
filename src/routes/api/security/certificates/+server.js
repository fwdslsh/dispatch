import { json } from '@sveltejs/kit';
import { CertificateManager } from '../../../../lib/server/shared/security/CertificateManager.js';
import { DatabaseManager } from '../../../../lib/server/shared/db/DatabaseManager.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	try {
		const dbManager = new DatabaseManager();
		await dbManager.init();

		// Use a test secret - in production this should come from environment
		const appSecret = process.env.APP_SECRET || 'default-secret-for-development';
		const certManager = new CertificateManager(dbManager, appSecret);

		const action = url.searchParams.get('action');

		switch (action) {
			case 'health':
				const health = await certManager.getCertificateHealth();
				return json({ success: true, health });

			case 'expiring':
				const days = parseInt(url.searchParams.get('days') || '30');
				const expiring = await certManager.getCertificatesExpiringSoon(days);
				return json({ success: true, certificates: expiring });

			case 'renewals':
				const renewals = await certManager.getPendingRenewals();
				return json({ success: true, renewals });

			default:
				// List all certificates
				const certificates = await certManager.listCertificates();
				return json({ success: true, certificates });
		}

	} catch (error) {
		console.error('Error managing certificates:', error);
		return json({
			success: false,
			error: error.message
		}, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const data = await request.json();
		const { action, ...certData } = data;

		const dbManager = new DatabaseManager();
		await dbManager.init();

		const appSecret = process.env.APP_SECRET || 'default-secret-for-development';
		const certManager = new CertificateManager(dbManager, appSecret);

		switch (action) {
			case 'upload-mkcert':
				const uploadResult = await certManager.uploadMkcertCertificate(certData);
				return json(uploadResult);

			case 'provision-letsencrypt':
				const { domain, email } = certData;
				const provisionResult = await certManager.provisionLetsEncryptCertificate(domain, email);
				return json(provisionResult);

			case 'renew':
				const { certificateId } = certData;
				const renewResult = await certManager.renewCertificate(certificateId);
				return json(renewResult);

			case 'schedule-renewal':
				const { certificateId: scheduleId, renewalDate } = certData;
				await certManager.scheduleRenewal(scheduleId, new Date(renewalDate));
				return json({ success: true, message: 'Renewal scheduled successfully' });

			default:
				return json({
					success: false,
					error: `Unknown action: ${action}`
				}, { status: 400 });
		}

	} catch (error) {
		console.error('Error processing certificate action:', error);
		return json({
			success: false,
			error: error.message
		}, { status: 500 });
	}
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ request }) {
	try {
		const { certificateId } = await request.json();

		const dbManager = new DatabaseManager();
		await dbManager.init();

		const appSecret = process.env.APP_SECRET || 'default-secret-for-development';
		const certManager = new CertificateManager(dbManager, appSecret);

		const success = await certManager.deleteCertificate(certificateId);

		if (success) {
			return json({ success: true, message: 'Certificate deleted successfully' });
		} else {
			return json({ success: false, error: 'Certificate not found' }, { status: 404 });
		}

	} catch (error) {
		console.error('Error deleting certificate:', error);
		return json({
			success: false,
			error: error.message
		}, { status: 500 });
	}
}