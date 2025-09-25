import { json } from '@sveltejs/kit';
import { CertificateManager } from '../../../../../lib/server/shared/security/CertificateManager.js';
import { DatabaseManager } from '../../../../../lib/server/shared/db/DatabaseManager.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ params }) {
	try {
		const certificateId = parseInt(params.id);

		const dbManager = new DatabaseManager();
		await dbManager.init();

		const appSecret = process.env.APP_SECRET || 'default-secret-for-development';
		const certManager = new CertificateManager(dbManager, appSecret);

		const certificate = await certManager.getCertificate(certificateId);

		if (!certificate) {
			return json(
				{
					success: false,
					error: 'Certificate not found'
				},
				{ status: 404 }
			);
		}

		// Don't return private key in GET requests for security
		const { privateKey, ...safeCertificate } = certificate;

		return json({
			success: true,
			certificate: safeCertificate
		});
	} catch (error) {
		console.error('Error getting certificate:', error);
		return json(
			{
				success: false,
				error: error.message
			},
			{ status: 500 }
		);
	}
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ params, request }) {
	try {
		const certificateId = parseInt(params.id);
		const { action } = await request.json();

		const dbManager = new DatabaseManager();
		await dbManager.init();

		const appSecret = process.env.APP_SECRET || 'default-secret-for-development';
		const certManager = new CertificateManager(dbManager, appSecret);

		switch (action) {
			case 'export':
				const exportData = await certManager.exportCertificate(certificateId);
				if (!exportData) {
					return json(
						{
							success: false,
							error: 'Certificate not found'
						},
						{ status: 404 }
					);
				}
				return json({ success: true, export: exportData });

			case 'activate':
				await certManager.daos.certificate.activate(certificateId);
				return json({ success: true, message: 'Certificate activated' });

			case 'deactivate':
				await certManager.daos.certificate.deactivate(certificateId);
				return json({ success: true, message: 'Certificate deactivated' });

			default:
				return json(
					{
						success: false,
						error: `Unknown action: ${action}`
					},
					{ status: 400 }
				);
		}
	} catch (error) {
		console.error('Error processing certificate action:', error);
		return json(
			{
				success: false,
				error: error.message
			},
			{ status: 500 }
		);
	}
}
