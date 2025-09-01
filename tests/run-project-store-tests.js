// tests/run-project-store-tests.js
// Simple test runner for project store functionality

import fs from 'fs';
import path from 'path';
import { 
  createProject, 
  getProjects, 
  getProject,
  updateProject,
  deleteProject,
  addSessionToProject,
  updateSessionInProject,
  removeSessionFromProject,
  setActiveProject,
  getAllProjectNames,
  initializeProjectStore,
  migrateSessionsToProjects
} from '../src/lib/server/project-store.js';

// Test environment setup
const TEST_PTY_ROOT = '/tmp/dispatch-test-projects';
process.env.PTY_ROOT = TEST_PTY_ROOT;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
  }
}

// Clean up test environment
function cleanup() {
  try {
    if (fs.existsSync(TEST_PTY_ROOT)) {
      fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('Cleanup warning:', err.message);
  }
}

console.log('Running project store tests...\n');

// Clean up before tests
cleanup();

try {
  // Test 1: Initialize project store
  console.log('Testing initializeProjectStore...');
  const initResult = initializeProjectStore();
  assert(typeof initResult.projectCount === 'number', 'Should return project count');
  // Don't assert 0 since there might be existing projects from other tests
  console.log(`✓ initializeProjectStore tests passed (found ${initResult.projectCount} existing projects)`);

  // Test 2: Create project
  console.log('Testing createProject...');
  const uniqueProjectName = `Test Project ${Date.now()}`;
  const project1 = createProject({ name: uniqueProjectName, description: 'A test project' });
  assert(project1.id, 'Should have an ID');
  assertEqual(project1.name, uniqueProjectName, 'Should have correct name');
  assertEqual(project1.description, 'A test project', 'Should have correct description');
  assert(project1.createdAt, 'Should have creation timestamp');
  assert(Array.isArray(project1.sessions), 'Should have sessions array');
  assertEqual(project1.sessions.length, 0, 'Should start with no sessions');
  console.log('✓ createProject tests passed');

  // Test 3: Get projects
  console.log('Testing getProjects...');
  const projects = getProjects();
  assert(Array.isArray(projects.projects), 'Should return projects array');
  const initialCount = projects.projects.length;
  assertEqual(projects.projects.filter(p => p.id === project1.id).length, 1, 'Should contain created project');
  console.log('✓ getProjects tests passed');

  // Test 4: Get single project
  console.log('Testing getProject...');
  const fetchedProject = getProject(project1.id);
  assert(fetchedProject, 'Should find project');
  assertEqual(fetchedProject.name, uniqueProjectName, 'Should have correct name');
  const nonExistent = getProject('non-existent-id');
  assertEqual(nonExistent, null, 'Should return null for non-existent project');
  console.log('✓ getProject tests passed');

  // Test 5: Update project
  console.log('Testing updateProject...');
  const uniqueUpdateName = `Updated Project ${Date.now()}`;
  const updatedProject = updateProject(project1.id, { name: uniqueUpdateName, description: 'Updated description' });
  assertEqual(updatedProject.name, uniqueUpdateName, 'Should update name');
  assertEqual(updatedProject.description, 'Updated description', 'Should update description');
  console.log('✓ updateProject tests passed');

  // Test 6: Add session to project
  console.log('Testing addSessionToProject...');
  const session1 = addSessionToProject(project1.id, { 
    id: 'session-1', 
    name: 'Main Terminal', 
    type: 'pty',
    status: 'active'
  });
  assertEqual(session1.id, 'session-1', 'Should have correct ID');
  assertEqual(session1.name, 'Main Terminal', 'Should have correct name');
  assertEqual(session1.type, 'pty', 'Should have correct type');
  assertEqual(session1.status, 'active', 'Should have correct status');
  assert(session1.createdAt, 'Should have creation timestamp');
  console.log('✓ addSessionToProject tests passed');

  // Test 7: Update session in project
  console.log('Testing updateSessionInProject...');
  const updatedSession = updateSessionInProject(project1.id, 'session-1', { 
    name: 'Updated Terminal',
    status: 'stopped'
  });
  assertEqual(updatedSession.name, 'Updated Terminal', 'Should update session name');
  assertEqual(updatedSession.status, 'stopped', 'Should update session status');
  console.log('✓ updateSessionInProject tests passed');

  // Test 8: Set active project
  console.log('Testing setActiveProject...');
  const activeId = setActiveProject(project1.id);
  assertEqual(activeId, project1.id, 'Should return active project ID');
  const projectsWithActive = getProjects();
  assertEqual(projectsWithActive.activeProject, project1.id, 'Should set active project');
  console.log('✓ setActiveProject tests passed');

  // Test 9: Get all project names
  console.log('Testing getAllProjectNames...');
  const project2 = createProject({ name: `Second Project ${Date.now()}` });
  const names = getAllProjectNames();
  assert(names.includes(uniqueUpdateName), 'Should include first project name');
  assert(names.includes(project2.name), 'Should include second project name');
  assert(names.length >= 2, 'Should have at least 2 project names');
  console.log('✓ getAllProjectNames tests passed');

  // Test 10: Remove session from project
  console.log('Testing removeSessionFromProject...');
  const removed = removeSessionFromProject(project1.id, 'session-1');
  assert(removed, 'Should return true for successful removal');
  const projectAfterRemoval = getProject(project1.id);
  assertEqual(projectAfterRemoval.sessions.length, 0, 'Should have no sessions after removal');
  console.log('✓ removeSessionFromProject tests passed');

  // Test 11: Delete project
  console.log('Testing deleteProject...');
  const deleted = deleteProject(project2.id);
  assert(deleted, 'Should return true for successful deletion');
  const projectsAfterDeletion = getProjects();
  assertEqual(projectsAfterDeletion.projects.filter(p => p.id === project2.id).length, 0, 'Should not find deleted project');
  console.log('✓ deleteProject tests passed');

  // Test 12: Migration
  console.log('Testing migrateSessionsToProjects...');
  const timestamp = Date.now();
  const existingSessions = [
    { id: `old-session-${timestamp}-1`, name: `Old Session ${timestamp} 1` },
    { id: `old-session-${timestamp}-2`, name: `Old Session ${timestamp} 2` }
  ];
  const migrated = migrateSessionsToProjects(existingSessions);
  assertEqual(migrated, 2, 'Should migrate 2 sessions');
  console.log('✓ migrateSessionsToProjects tests passed');

  // Test error cases
  console.log('Testing error cases...');
  
  try {
    createProject({ name: '' });
    assert(false, 'Should reject empty project name');
  } catch (err) {
    assert(err.message.includes('Project name is required'), 'Should have appropriate error message');
  }
  
  try {
    updateProject('non-existent', { name: 'Test' });
    assert(false, 'Should reject non-existent project');
  } catch (err) {
    assert(err.message.includes('Project not found'), 'Should have appropriate error message');
  }
  
  console.log('✓ Error handling tests passed');

  console.log('\n🎉 All project store tests passed!');

} catch (err) {
  console.error('\n❌ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
} finally {
  // Clean up after tests
  cleanup();
}