import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import MobileKeyboardToolbar from '../../../src/lib/client/terminal/MobileKeyboardToolbar.svelte';
import MobileTextInput from '../../../src/lib/client/terminal/MobileTextInput.svelte';

// Mock window properties for mobile detection
Object.defineProperty(window, 'innerWidth', {
	writable: true,
	configurable: true,
	value: 375
});

Object.defineProperty(window, 'maxTouchPoints', {
	writable: true,
	configurable: true,
	value: 10
});

describe('MobileKeyboardToolbar', () => {
	it('renders toolbar buttons', () => {
		const { container } = render(MobileKeyboardToolbar, {
			props: {
				visible: true,
				disabled: false
			}
		});
		
		// Check for arrow keys
		expect(screen.getByLabelText('↑')).toBeInTheDocument();
		expect(screen.getByLabelText('↓')).toBeInTheDocument();
		expect(screen.getByLabelText('←')).toBeInTheDocument();
		expect(screen.getByLabelText('→')).toBeInTheDocument();
		
		// Check for control keys
		expect(screen.getByLabelText('^C')).toBeInTheDocument();
		expect(screen.getByLabelText('^D')).toBeInTheDocument();
		
		// Check for special keys
		expect(screen.getByLabelText('Esc')).toBeInTheDocument();
		expect(screen.getByLabelText('Tab')).toBeInTheDocument();
	});

	it('dispatches keypress events when buttons are clicked', async () => {
		let capturedEvent = null;
		
		const { component } = render(MobileKeyboardToolbar, {
			props: {
				visible: true,
				disabled: false
			}
		});

		// Listen for keypress events
		component.$on('keypress', (event) => {
			capturedEvent = event.detail;
		});

		// Click the Ctrl+C button
		const ctrlCButton = screen.getByLabelText('^C');
		await fireEvent.click(ctrlCButton);

		expect(capturedEvent).toBeTruthy();
		expect(capturedEvent.key).toBe('\x03'); // ASCII 3 for Ctrl+C
		expect(capturedEvent.label).toBe('^C');
	});

	it('disables buttons when disabled prop is true', () => {
		render(MobileKeyboardToolbar, {
			props: {
				visible: true,
				disabled: true
			}
		});

		const buttons = screen.getAllByRole('button');
		buttons.forEach(button => {
			expect(button).toBeDisabled();
		});
	});

	it('switches to compact mode', () => {
		const { container } = render(MobileKeyboardToolbar, {
			props: {
				visible: true,
				disabled: false,
				compact: true
			}
		});

		expect(container.querySelector('.compact')).toBeInTheDocument();
	});
});

describe('MobileTextInput', () => {
	it('renders input field and send button', () => {
		render(MobileTextInput, {
			props: {
				visible: true,
				disabled: false
			}
		});

		expect(screen.getByPlaceholderText('Type commands here...')).toBeInTheDocument();
		expect(screen.getByLabelText('Send command')).toBeInTheDocument();
	});

	it('dispatches submit event when send button is clicked', async () => {
		let capturedEvent = null;
		
		const { component } = render(MobileTextInput, {
			props: {
				visible: true,
				disabled: false
			}
		});

		// Listen for submit events
		component.$on('submit', (event) => {
			capturedEvent = event.detail;
		});

		// Type a command and click send
		const input = screen.getByPlaceholderText('Type commands here...');
		await fireEvent.input(input, { target: { value: 'ls -la' } });
		
		const sendButton = screen.getByLabelText('Send command');
		await fireEvent.click(sendButton);

		expect(capturedEvent).toBeTruthy();
		expect(capturedEvent.command).toBe('ls -la\r'); // Should include carriage return
		expect(capturedEvent.text).toBe('ls -la');
	});

	it('shows suggestions for common commands', async () => {
		render(MobileTextInput, {
			props: {
				visible: true,
				disabled: false
			}
		});

		const input = screen.getByPlaceholderText('Type commands here...');
		await fireEvent.input(input, { target: { value: 'gi' } });

		// Should show git-related suggestions
		expect(screen.getByText('git status')).toBeInTheDocument();
		expect(screen.getByText('git add')).toBeInTheDocument();
	});

	it('handles Enter key to submit command', async () => {
		let capturedEvent = null;
		
		const { component } = render(MobileTextInput, {
			props: {
				visible: true,
				disabled: false
			}
		});

		component.$on('submit', (event) => {
			capturedEvent = event.detail;
		});

		const input = screen.getByPlaceholderText('Type commands here...');
		await fireEvent.input(input, { target: { value: 'pwd' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(capturedEvent).toBeTruthy();
		expect(capturedEvent.text).toBe('pwd');
	});

	it('navigates command history with arrow keys', async () => {
		const { component } = render(MobileTextInput, {
			props: {
				visible: true,
				disabled: false
			}
		});

		// First, submit some commands to build history
		const input = screen.getByPlaceholderText('Type commands here...');
		
		// Submit first command
		await fireEvent.input(input, { target: { value: 'ls' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		
		// Submit second command
		await fireEvent.input(input, { target: { value: 'pwd' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		// Now test history navigation
		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		expect(input.value).toBe('pwd');

		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		expect(input.value).toBe('ls');
	});
});