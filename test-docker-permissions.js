#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const testDir = '/tmp/dispatch-permission-test';
const projectsDir = path.join(testDir, 'projects');
const homeDir = path.join(testDir, 'home');

async function runCommand(command, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, { 
            stdio: 'pipe',
            ...options 
        });
        
        let stdout = '';
        let stderr = '';
        
        proc.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        
        proc.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        
        proc.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr, code });
            } else {
                reject(new Error(`Command failed with code ${code}\nstdout: ${stdout}\nstderr: ${stderr}`));
            }
        });
    });
}

async function testDockerPermissions() {
    console.log('🧪 Testing Docker permissions setup...\n');
    
    try {
        // Clean up any existing test directories
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        
        // Create test directories
        fs.mkdirSync(projectsDir, { recursive: true });
        fs.mkdirSync(homeDir, { recursive: true });
        
        console.log('✅ Created test directories');
        
        // Get current user info
        const uid = process.getuid();
        const gid = process.getgid();
        
        console.log(`📋 Current user: UID=${uid}, GID=${gid}`);
        
        // Test 1: Create a simple Dockerfile to test user creation
        const testDockerfile = `
FROM alpine:latest
ARG USER_UID=1000
ARG USER_GID=1000
RUN addgroup -g \${USER_GID} testuser 2>/dev/null || true \\
    && adduser -D -u \${USER_UID} -G testuser testuser 2>/dev/null || true
USER testuser
CMD ["id"]
`;
        
        fs.writeFileSync(path.join(testDir, 'Dockerfile'), testDockerfile);
        console.log('✅ Created test Dockerfile');
        
        // Test 2: Build image with current user's UID/GID
        console.log('🏗️  Building test image...');
        await runCommand('docker', [
            'build',
            '-t', 'dispatch-permission-test',
            '--build-arg', `USER_UID=${uid}`,
            '--build-arg', `USER_GID=${gid}`,
            testDir
        ]);
        console.log('✅ Built test image successfully');
        
        // Test 3: Run container and check user mapping
        console.log('🚀 Testing user mapping in container...');
        const result = await runCommand('docker', [
            'run', '--rm',
            '-v', `${projectsDir}:/test-projects`,
            '-v', `${homeDir}:/test-home`,
            'dispatch-permission-test'
        ]);
        
        const containerUser = result.stdout.trim();
        console.log(`📋 Container user: ${containerUser}`);
        
        // Test 4: Create files in mounted directories
        console.log('📝 Testing file creation in mounted directories...');
        
        await runCommand('docker', [
            'run', '--rm',
            '-v', `${projectsDir}:/test-projects`,
            '-v', `${homeDir}:/test-home`,
            'dispatch-permission-test',
            'sh', '-c', 'echo "test content" > /test-projects/test-file.txt && echo "home content" > /test-home/test-home-file.txt'
        ]);
        console.log('✅ Created files in container');
        
        // Test 5: Check file ownership on host
        const projectsFile = path.join(projectsDir, 'test-file.txt');
        const homeFile = path.join(homeDir, 'test-home-file.txt');
        
        if (!fs.existsSync(projectsFile) || !fs.existsSync(homeFile)) {
            throw new Error('Files were not created in mounted directories');
        }
        
        const projectsStat = fs.statSync(projectsFile);
        const homeStat = fs.statSync(homeFile);
        
        console.log(`📋 Projects file ownership: UID=${projectsStat.uid}, GID=${projectsStat.gid}`);
        console.log(`📋 Home file ownership: UID=${homeStat.uid}, GID=${homeStat.gid}`);
        
        // Verify ownership matches current user
        if (projectsStat.uid === uid && projectsStat.gid === gid && 
            homeStat.uid === uid && homeStat.gid === gid) {
            console.log('✅ File ownership matches host user - SUCCESS!');
        } else {
            throw new Error('File ownership does not match host user');
        }
        
        // Test 6: Verify files are readable/writable by host user
        const projectsContent = fs.readFileSync(projectsFile, 'utf8');
        const homeContent = fs.readFileSync(homeFile, 'utf8');
        
        if (projectsContent.includes('test content') && homeContent.includes('home content')) {
            console.log('✅ Files are readable by host user');
        } else {
            throw new Error('Files are not readable by host user');
        }
        
        // Modify files from host
        fs.writeFileSync(projectsFile, 'modified by host\n');
        fs.writeFileSync(homeFile, 'modified by host\n');
        console.log('✅ Files are writable by host user');
        
        console.log('\n🎉 All Docker permission tests passed!');
        console.log('\nKey results:');
        console.log('- Container user matches host user UID/GID');
        console.log('- Files created in container are owned by host user');
        console.log('- No permission changes required on host');
        console.log('- Seamless read/write access from both host and container');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    } finally {
        // Clean up
        try {
            await runCommand('docker', ['rmi', 'dispatch-permission-test'], { stdio: 'ignore' });
            if (fs.existsSync(testDir)) {
                fs.rmSync(testDir, { recursive: true, force: true });
            }
            console.log('\n🧹 Cleaned up test resources');
        } catch (error) {
            console.warn('⚠️  Warning: Could not clean up all test resources');
        }
    }
}

// Run the test
testDockerPermissions().catch(console.error);