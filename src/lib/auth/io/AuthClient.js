import { BaseClient } from '../../shared/io/BaseClient.js';

export class AuthClient extends BaseClient {
    constructor(io, config = {}) {
        super(io, '/auth', config);
        this.authenticated = false;
        this.authRequired = true;
    }

    setupEventListeners() {
        this.on('auth:status', this.handleAuthStatus.bind(this));
    }

    handleAuthStatus(data) {
        this.authenticated = data.authenticated;
        this.authRequired = data.authRequired;
        
        if (this.onAuthStatusChange) {
            this.onAuthStatusChange(data);
        }
    }

    async login(key) {
        return new Promise((resolve, reject) => {
            this.emit('auth:login', key, (response) => {
                if (response.success) {
                    this.authenticated = response.authenticated;
                    this.authRequired = response.authRequired;
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Authentication failed'));
                }
            });
        });
    }

    async check() {
        return new Promise((resolve, reject) => {
            this.emit('auth:check', (response) => {
                if (response.success) {
                    this.authenticated = response.authenticated;
                    this.authRequired = response.authRequired;
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Authentication check failed'));
                }
            });
        });
    }

    async logout() {
        return new Promise((resolve, reject) => {
            this.emit('auth:logout', (response) => {
                if (response.success) {
                    this.authenticated = response.authenticated;
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Logout failed'));
                }
            });
        });
    }

    isAuthenticated() {
        return this.authenticated;
    }

    isAuthRequired() {
        return this.authRequired;
    }

    onAuthStatusChange(callback) {
        this.onAuthStatusChange = callback;
    }
}