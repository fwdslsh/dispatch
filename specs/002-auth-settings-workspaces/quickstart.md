# Quickstart: UI Components for Authentication, Workspace Management, and Maintenance

## Overview
This quickstart validates the complete user journey for onboarding, workspace management, and maintenance features.

## Prerequisites
- Dispatch running in development mode with `TERMINAL_KEY=testkey12345`
- Clean browser state (no existing onboarding completion)
- Test workspace directory available

## User Journey Test Scenarios

### Scenario 1: First-Time User Onboarding

**Goal**: Verify progressive onboarding workflow with minimal required steps

**Steps**:
1. Navigate to http://localhost:3030
2. Verify authentication prompt appears
3. Enter terminal key: `testkey12345`
4. Verify onboarding detection triggers workflow
5. Follow minimal onboarding path:
   - Authentication confirmation ✓
   - First workspace creation
   - Skip advanced settings (progressive disclosure)
6. Verify redirection to newly created workspace
7. Confirm onboarding completion status persisted

**Expected Results**:
- User can complete onboarding in 2-3 steps
- Advanced settings remain accessible but non-blocking
- Authentication persists for 30-day rolling window
- First workspace immediately usable

**API Validation**:
```bash
# Check onboarding status
curl "http://localhost:3030/api/onboarding/status?authKey=testkey12345"
# Should return: {"currentStep": "complete", "isComplete": true}

# Verify user preferences created
curl "http://localhost:3030/api/preferences?authKey=testkey12345"
# Should return default preferences with onboardingCompleted: true
```

### Scenario 2: Workspace Navigation Enhancement

**Goal**: Verify enhanced ProjectSessionMenu supports workspace switching

**Steps**:
1. Ensure multiple workspaces exist (create if needed)
2. Locate ProjectSessionMenu in header
3. Click workspace dropdown
4. Verify workspace list displays with status indicators
5. Switch to different workspace
6. Verify session switching works correctly
7. Test workspace metadata display (creation date, session counts)

**Expected Results**:
- Workspace switcher integrated into existing menu
- One-click workspace switching
- Visual status indicators (active, archived)
- Workspace metadata visible

**API Validation**:
```bash
# List workspaces
curl "http://localhost:3030/api/workspaces?authKey=testkey12345"
# Should return workspaces with session counts and metadata

# Verify session-workspace association
curl "http://localhost:3030/api/sessions?include=all&authKey=testkey12345"
# Should show sessions linked to workspaces
```

### Scenario 3: Retention Policy Configuration

**Goal**: Verify retention policy settings with simple summary preview

**Steps**:
1. Navigate to settings (through onboarding or direct access)
2. Locate retention policy section
3. Modify session retention period (e.g., 30 → 14 days)
4. Modify log retention period (e.g., 7 → 3 days)
5. Request preview of changes
6. Verify simple summary format: "Will delete X sessions older than Y days"
7. Apply changes
8. Verify settings persistence

**Expected Results**:
- Retention settings accessible and intuitive
- Preview shows clear, simple summary
- Changes persist across sessions
- No overwhelming detail in preview

**API Validation**:
```bash
# Get current retention policy
curl "http://localhost:3030/api/retention/policy?authKey=testkey12345"

# Preview retention changes
curl -X POST "http://localhost:3030/api/retention/preview" \
  -H "Content-Type: application/json" \
  -d '{"authKey":"testkey12345","sessionRetentionDays":14,"logRetentionDays":3}'
# Should return summary like "Will delete 5 sessions older than 14 days"

# Update retention policy
curl -X PUT "http://localhost:3030/api/retention/policy" \
  -H "Content-Type: application/json" \
  -d '{"authKey":"testkey12345","sessionRetentionDays":14,"logRetentionDays":3}'
```

### Scenario 4: Authentication Session Persistence

**Goal**: Verify 30-day rolling session with browser session reset

**Steps**:
1. Complete authentication with terminal key
2. Verify immediate access without re-authentication
3. Close browser completely
4. Reopen browser and navigate to application
5. Verify session persistence (no re-authentication required)
6. Test activity-based session renewal
7. Simulate 30+ day gap (or modify timestamps for testing)
8. Verify session expiration and re-authentication requirement

**Expected Results**:
- Authentication persists across browser sessions
- Rolling window resets with each browser session
- Graceful handling of expired sessions

**Technical Validation**:
- Check browser storage for authentication tokens
- Verify session timestamp updates on activity
- Test session cleanup on expiration

### Scenario 5: Integration Test - Complete Workflow

**Goal**: Verify all components work together in realistic usage

**Steps**:
1. Fresh user: Complete onboarding workflow
2. Create 2-3 additional workspaces
3. Switch between workspaces using enhanced menu
4. Create sessions in different workspaces
5. Access settings and configure retention policies
6. Verify workspace session counts update
7. Test retention preview with real data
8. Execute cleanup (optional, with caution)

**Expected Results**:
- Seamless integration between all new features
- Data consistency across components
- Performance remains responsive
- No UI/UX conflicts with existing features

## Performance Benchmarks

### Page Load Performance
- First onboarding page: < 2 seconds
- Workspace switching: < 500ms
- Settings page load: < 1 second

### API Response Times
- Authentication check: < 100ms
- Workspace list: < 200ms
- Retention preview: < 300ms

### UI Responsiveness
- Component state updates: < 50ms
- Form validation feedback: immediate
- Navigation transitions: smooth (60fps)

## Error Scenarios

### Authentication Failures
1. Invalid terminal key → Clear error message
2. Expired session → Graceful re-authentication prompt
3. Network errors → Retry with user feedback

### Workspace Management Errors
1. Invalid workspace names → Validation feedback
2. Workspace creation failures → Error details
3. Active sessions prevent deletion → Clear explanation

### Retention Policy Errors
1. Invalid retention periods → Range validation
2. Preview generation failures → Error handling
3. Cleanup conflicts → Safe failure modes

## Cleanup After Testing

1. Reset onboarding state: Delete entries from `onboarding_state` table
2. Clean test workspaces: Remove test directories and database entries
3. Reset user preferences: Clear `user_preferences` table
4. Clear browser storage: Remove authentication tokens

## Success Criteria

✅ All user scenarios complete without errors
✅ API responses meet performance benchmarks
✅ Error scenarios handled gracefully
✅ No regression in existing functionality
✅ Constitutional compliance maintained
✅ Accessibility standards met (keyboard navigation, ARIA labels)

## Notes

- Run scenarios in order - onboarding affects subsequent tests
- Test with both empty and populated workspace states
- Verify mobile responsive behavior on smaller screens
- Test keyboard navigation throughout all workflows
- Validate with screen reader for accessibility compliance