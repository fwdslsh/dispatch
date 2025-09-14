import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import ClaudePane from '$lib/client/claude/ClaudePane.svelte';

describe('ClaudePane CWD Display', () => {
	it('should display the workspace path in the header', async () => {
		const { container } = render(ClaudePane, {
			props: {
				sessionId: 'test-session',
				workspacePath: '/home/user/workspace/my-app'
			}
		});

		// Check if the CWD element exists
		const cwdElement = container.querySelector('.ai-cwd');
		expect(cwdElement).toBeTruthy();

		// Check if the title attribute shows the full path
		expect(cwdElement.getAttribute('title')).toBe('/home/user/workspace/my-app');

		// Check if the displayed text shows just the folder name
		const cwdPath = container.querySelector('.cwd-path');
		expect(cwdPath.textContent).toBe('my-app');
	});

	it('should handle root path correctly', async () => {
		const { container } = render(ClaudePane, {
			props: {
				sessionId: 'test-session',
				workspacePath: '/'
			}
		});

		const cwdPath = container.querySelector('.cwd-path');
		expect(cwdPath.textContent).toBe('/');
	});

	it('should not display CWD section when workspacePath is empty', async () => {
		const { container } = render(ClaudePane, {
			props: {
				sessionId: 'test-session',
				workspacePath: ''
			}
		});

		const cwdElement = container.querySelector('.ai-cwd');
		expect(cwdElement).toBeFalsy();
	});

	it('should handle deeply nested paths', async () => {
		const { container } = render(ClaudePane, {
			props: {
				sessionId: 'test-session',
				workspacePath: '/very/long/path/to/deeply/nested/project-folder'
			}
		});

		const cwdElement = container.querySelector('.ai-cwd');
		expect(cwdElement.getAttribute('title')).toBe(
			'/very/long/path/to/deeply/nested/project-folder'
		);

		const cwdPath = container.querySelector('.cwd-path');
		expect(cwdPath.textContent).toBe('project-folder');
	});
});
