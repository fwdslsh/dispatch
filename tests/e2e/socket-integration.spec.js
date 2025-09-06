import { test, expect } from '@playwright/test';

// Note: These tests use socket.io directly to avoid Playwright browser installation issues
// in the CI environment. They test the core socket functionality that the UI depends on.

import { io } from 'socket.io-client';

const TEST_KEY = 'testkey12345';
const SERVER_URL = 'http://localhost:5173';

test.describe('Socket-based Application Tests', () => {
    test('authentication should work correctly', async () => {
        const socket = io(`${SERVER_URL}/auth`);
        
        const authResult = await new Promise((resolve, reject) => {
            socket.on('connect', () => {
                socket.emit('auth:login', TEST_KEY, (response) => {
                    socket.disconnect();
                    resolve(response);
                });
            });
            
            socket.on('connect_error', (error) => {
                socket.disconnect();
                reject(error);
            });
            
            setTimeout(() => {
                socket.disconnect();
                reject(new Error('Auth timeout'));
            }, 5000);
        });
        
        expect(authResult.success).toBe(true);
        expect(authResult.authenticated).toBe(true);
    });

    test('sessions listing should work', async () => {
        const socket = io(`${SERVER_URL}/sessions`);
        
        const sessionsResult = await new Promise((resolve, reject) => {
            socket.on('connect', () => {
                socket.emit('sessions:list', (response) => {
                    socket.disconnect();
                    resolve(response);
                });
            });
            
            socket.on('connect_error', (error) => {
                socket.disconnect();
                reject(error);
            });
            
            setTimeout(() => {
                socket.disconnect();
                reject(new Error('Sessions timeout'));
            }, 5000);
        });
        
        expect(sessionsResult.success).toBe(true);
        expect(Array.isArray(sessionsResult.sessions)).toBe(true);
    });

    test('Claude authentication check should work', async () => {
        const socket = io(`${SERVER_URL}/claude`);
        
        const claudeAuthResult = await new Promise((resolve, reject) => {
            socket.on('connect', () => {
                socket.emit('claude:auth', (response) => {
                    socket.disconnect();
                    resolve(response);
                });
            });
            
            socket.on('connect_error', (error) => {
                socket.disconnect();
                reject(error);
            });
            
            setTimeout(() => {
                socket.disconnect();
                reject(new Error('Claude auth timeout'));
            }, 5000);
        });
        
        expect(claudeAuthResult.success).toBe(true);
        expect(typeof claudeAuthResult.authenticated).toBe('boolean');
    });

    test('Claude authentication flow should start correctly', async () => {
        const socket = io(`${SERVER_URL}/claude`);
        
        const authFlowResult = await new Promise((resolve, reject) => {
            let authStarted = false;
            
            socket.on('connect', () => {
                // Listen for auth events
                socket.on('claude:auth-started', (data) => {
                    authStarted = true;
                    expect(data.success).toBe(true);
                    expect(data.message).toContain('Authentication flow started');
                });
                
                // Start the auth flow
                socket.emit('claude:start-auth', (response) => {
                    if (response.success) {
                        // Wait a bit for the auth-started event
                        setTimeout(() => {
                            socket.disconnect();
                            resolve({ 
                                startResponse: response, 
                                authStarted 
                            });
                        }, 2000);
                    } else {
                        socket.disconnect();
                        reject(new Error('Auth flow start failed'));
                    }
                });
            });
            
            socket.on('connect_error', (error) => {
                socket.disconnect();
                reject(error);
            });
            
            setTimeout(() => {
                socket.disconnect();
                reject(new Error('Claude auth flow timeout'));
            }, 8000);
        });
        
        expect(authFlowResult.startResponse.success).toBe(true);
        expect(authFlowResult.authStarted).toBe(true);
    });
});