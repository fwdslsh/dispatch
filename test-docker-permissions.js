#!/usr/bin/env node

/**
 * Test script to verify Docker permissions and user mapping work correctly.
 * Tests both local build and Docker Hub scenarios.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const TEST_DIR = '/tmp/dispatch-permission-test';
const HOST_UID = process.getuid ? process.getuid() : 1000;
const HOST_GID = process.getgid ? process.getgid() : 1000;

console.log('🧪 Testing Dispatch Docker Permissions');
console.log(`   Host User: ${HOST_UID}:${HOST_GID}`);
console.log(`   Test Directory: ${TEST_DIR}`);

function cleanup() {
	console.log('🧹 Cleaning up test environment...');
	
	// Stop and remove test containers
	try {
		spawn('docker', ['stop', 'dispatch-test'], { stdio: 'ignore' });
		spawn('docker', ['rm', 'dispatch-test'], { stdio: 'ignore' });
		spawn('docker', ['stop', 'dispatch-test-local'], { stdio: 'ignore' });
		spawn('docker', ['rm', 'dispatch-test-local'], { stdio: 'ignore' });
	} catch (error) {
		// Ignore cleanup errors
	}
	
	// Remove test directory
	if (fs.existsSync(TEST_DIR)) {
		fs.rmSync(TEST_DIR, { recursive: true, force: true });
	}
}

function setupTestDirectory() {
	console.log('📁 Setting up test directories...');
	
	// Remove existing test directory
	if (fs.existsSync(TEST_DIR)) {
		fs.rmSync(TEST_DIR, { recursive: true, force: true });
	}
	
	// Create test directories
	fs.mkdirSync(TEST_DIR, { recursive: true });
	fs.mkdirSync(path.join(TEST_DIR, 'projects'), { recursive: true });
	fs.mkdirSync(path.join(TEST_DIR, 'home'), { recursive: true });
	
	console.log('✅ Test directories created');
}

function runCommand(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: 'pipe',
			...options
		});
		
		let stdout = '';
		let stderr = '';
		
		child.stdout?.on('data', (data) => {
			stdout += data.toString();
		});
		
		child.stderr?.on('data', (data) => {
			stderr += data.toString();
		});
		
		child.on('close', (code) => {
			if (code === 0) {
				resolve({ stdout, stderr });
			} else {
				reject(new Error(`Command failed with code ${code}: ${stderr}`));
			}
		});
	});
}

async function testDockerHubImage() {
	console.log('\n🐳 Testing Docker Hub Image with Runtime User Mapping...');
	
	try {
		// Pull the latest image
		console.log('📥 Pulling Docker Hub image...');
		await runCommand('docker', ['pull', 'fwdslsh/dispatch:latest']);
		console.log('✅ Image pulled successfully');
		
		// Run container with runtime user mapping
		console.log('🚀 Starting container with runtime user mapping...');
		await runCommand('docker', [
			'run', '-d',
			'--name', 'dispatch-test',
			'-p', '3031:3030',
			'-e', `HOST_UID=${HOST_UID}`,
			'-e', `HOST_GID=${HOST_GID}`,
			'-e', 'TERMINAL_KEY=test-key',
			'-v', `${TEST_DIR}/projects:/workspace`,
			'-v', `${TEST_DIR}/home:/home/dispatch`,
			'fwdslsh/dispatch:latest'
		]);
		console.log('✅ Container started');
		
		// Wait for container to initialize
		console.log('⏳ Waiting for container to initialize...');
		await new Promise(resolve => setTimeout(resolve, 5000));
		
		// Check container user
		console.log('👤 Checking container user mapping...');
		const { stdout: containerUser } = await runCommand('docker', [
			'exec', 'dispatch-test', 'id'
		]);
		console.log(`   Container user: ${containerUser.trim()}`);
		
		// Verify user mapping
		if (containerUser.includes(`uid=${HOST_UID}`) && containerUser.includes(`gid=${HOST_GID}`)) {
			console.log('✅ User mapping successful');
		} else {
			throw new Error('User mapping failed - UID/GID mismatch');
		}
		
		// Test file creation from container
		console.log('📝 Testing file creation from container...');
		await runCommand('docker', [
			'exec', 'dispatch-test', 
			'touch', '/workspace/container-created-file.txt'
		]);
		
		await runCommand('docker', [
			'exec', 'dispatch-test',
			'sh', '-c', 'echo "Hello from container" > /workspace/container-created-file.txt'
		]);
		
		// Check file ownership on host
		const containerFile = path.join(TEST_DIR, 'projects', 'container-created-file.txt');
		if (!fs.existsSync(containerFile)) {
			throw new Error('Container-created file not found on host');
		}
		
		const stats = fs.statSync(containerFile);
		if (stats.uid === HOST_UID && stats.gid === HOST_GID) {
			console.log('✅ Container-created file has correct ownership');
		} else {
			throw new Error(`File ownership incorrect: ${stats.uid}:${stats.gid} (expected ${HOST_UID}:${HOST_GID})`);
		}
		
		// Test file creation from host
		console.log('📝 Testing file creation from host...');
		const hostFile = path.join(TEST_DIR, 'projects', 'host-created-file.txt');
		fs.writeFileSync(hostFile, 'Hello from host');
		
		// Check file accessibility from container
		const { stdout: fileContent } = await runCommand('docker', [
			'exec', 'dispatch-test',
			'cat', '/workspace/host-created-file.txt'
		]);
		
		if (fileContent.trim() === 'Hello from host') {
			console.log('✅ Host-created file accessible from container');
		} else {
			throw new Error('Host-created file not accessible from container');
		}
		
		console.log('✅ Docker Hub image test completed successfully');
		return true;
		
	} catch (error) {
		console.error('❌ Docker Hub image test failed:', error.message);
		return false;
	} finally {
		// Clean up test container
		try {
			await runCommand('docker', ['stop', 'dispatch-test']);
			await runCommand('docker', ['rm', 'dispatch-test']);
		} catch (error) {
			// Ignore cleanup errors
		}
	}
}

async function testLocalBuild() {
	console.log('\n🔨 Testing Local Build with Build-time User Mapping...');
	
	try {
		// Build image with current user UID/GID
		console.log('🔨 Building local image with user mapping...');
		await runCommand('docker', [
			'build',
			'-f', 'docker/Dockerfile',
			'-t', 'dispatch-test-local',
			'--build-arg', `USER_UID=${HOST_UID}`,
			'--build-arg', `USER_GID=${HOST_GID}`,
			'.'
		]);
		console.log('✅ Local image built successfully');
		
		// Run container
		console.log('🚀 Starting locally built container...');
		await runCommand('docker', [
			'run', '-d',
			'--name', 'dispatch-test-local',
			'-p', '3032:3030',
			'-e', `HOST_UID=${HOST_UID}`,
			'-e', `HOST_GID=${HOST_GID}`,
			'-e', 'TERMINAL_KEY=test-key',
			'-v', `${TEST_DIR}/projects:/workspace`,
			'-v', `${TEST_DIR}/home:/home/dispatch`,
			'dispatch-test-local'
		]);
		console.log('✅ Container started');
		
		// Wait for container to initialize
		console.log('⏳ Waiting for container to initialize...');
		await new Promise(resolve => setTimeout(resolve, 5000));
		
		// Check container user
		console.log('👤 Checking container user mapping...');
		const { stdout: containerUser } = await runCommand('docker', [
			'exec', 'dispatch-test-local', 'id'
		]);
		console.log(`   Container user: ${containerUser.trim()}`);
		
		// Verify user mapping
		if (containerUser.includes(`uid=${HOST_UID}`) && containerUser.includes(`gid=${HOST_GID}`)) {
			console.log('✅ User mapping successful (build-time)');
		} else {
			throw new Error('User mapping failed - UID/GID mismatch');
		}
		
		console.log('✅ Local build test completed successfully');
		return true;
		
	} catch (error) {
		console.error('❌ Local build test failed:', error.message);
		return false;
	} finally {
		// Clean up test container
		try {
			await runCommand('docker', ['stop', 'dispatch-test-local']);
			await runCommand('docker', ['rm', 'dispatch-test-local']);
		} catch (error) {
			// Ignore cleanup errors
		}
	}
}

async function main() {
	// Setup test environment
	setupTestDirectory();
	
	let dockerHubSuccess = false;
	let localBuildSuccess = false;
	
	try {
		// Test Docker Hub scenario (primary use case)
		dockerHubSuccess = await testDockerHubImage();
		
		// Test local build scenario  
		localBuildSuccess = await testLocalBuild();
		
	} finally {
		cleanup();
	}
	
	// Report results
	console.log('\n📊 Test Results Summary:');
	console.log(`   Docker Hub Image: ${dockerHubSuccess ? '✅ PASS' : '❌ FAIL'}`);
	console.log(`   Local Build: ${localBuildSuccess ? '✅ PASS' : '❌ FAIL'}`);
	
	if (dockerHubSuccess && localBuildSuccess) {
		console.log('\n🎉 All tests passed! Docker permissions work correctly.');
		console.log('✅ Users can pull from Docker Hub and have proper file permissions');
		console.log('✅ Local builds also work for advanced users');
		process.exit(0);
	} else {
		console.log('\n❌ Some tests failed. Check the errors above.');
		process.exit(1);
	}
}

// Handle cleanup on exit
process.on('exit', cleanup);
process.on('SIGINT', () => {
	cleanup();
	process.exit(1);
});
process.on('SIGTERM', () => {
	cleanup();
	process.exit(1);
});

// Run tests
main().catch((error) => {
	console.error('❌ Test execution failed:', error);
	cleanup();
	process.exit(1);
});