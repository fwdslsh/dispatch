# Home Directory Manager Implementation

## Overview

The Home Directory Manager is a new feature added to the Dispatch Settings Modal that provides secure file management capabilities within the user's home directory. This feature enables users to browse, edit, upload, and manage files directly from the web interface while maintaining strict security boundaries.

## Features

### Core Functionality
- **Secure Directory Browsing**: Navigate through the home directory and subdirectories with breadcrumb navigation
- **File Editing**: In-browser file editing with syntax highlighting and real-time save functionality
- **File Upload**: Drag-and-drop file upload support
- **File Management**: Create, delete, and manage files and directories
- **Git Integration**: View git status and branch information when in a git repository

### Security Features
- **Path Validation**: All API endpoints validate paths to ensure operations stay within the home directory
- **Access Control**: Server-side security checks prevent access to system files and other users' directories
- **403 Forbidden**: Unauthorized access attempts return proper HTTP 403 Forbidden responses
- **No Path Traversal**: Protection against path traversal attacks and directory escape attempts

## Implementation Details

### API Endpoints

#### `/api/browse/home` - Directory Browsing
- **Method**: GET
- **Purpose**: Secure browsing of home directory contents
- **Security**: Validates all paths are within `$HOME` directory
- **Response**: Directory contents with file/folder metadata

#### `/api/files/home` - File Operations
- **Methods**: GET (read), PUT (write), DELETE (delete)
- **Purpose**: File content management within home directory
- **Security**: Path validation ensures home directory containment
- **Features**: Supports file reading, writing, and deletion

#### `/api/files/home/upload` - File Upload
- **Method**: POST
- **Purpose**: Upload files to home directory
- **Security**: Validates target directory is within home
- **Features**: Multiple file upload with unique filename generation

### UI Components

#### `HomeDirectoryManager.svelte`
- **Location**: `src/lib/client/shared/components/Settings/HomeDirectoryManager.svelte`
- **Purpose**: Main component providing file management interface
- **Features**:
  - Directory browser integration
  - File editor integration
  - Upload functionality
  - Error handling and user feedback
  - State persistence across sessions

#### Settings Modal Integration
- **Location**: `src/lib/client/shared/components/Settings/SettingsModal.svelte`
- **Integration**: Added as new "Home Directory" tab with user icon
- **Consistent**: Follows existing Settings Modal design patterns

### Security Implementation

#### Path Validation Function
```javascript
function isPathWithinHome(requestedPath) {
    const homeDir = resolve(getHomeDirectory());
    const resolvedPath = resolve(requestedPath);
    
    // Ensure the path is within the home directory
    return resolvedPath.startsWith(homeDir);
}
```

#### Error Handling
- **403 Forbidden**: Returned for unauthorized path access
- **404 Not Found**: Returned for non-existent files/directories
- **413 Payload Too Large**: Returned for files exceeding size limits
- **500 Internal Server Error**: Returned for unexpected server errors

## Testing

### Automated Tests
- **Location**: `tests/server/home-directory-security.test.js`
- **Coverage**: Path validation logic and security restrictions
- **Scenarios**: 
  - Valid paths within home directory
  - Invalid paths outside home directory
  - Path traversal attack attempts

### Manual Testing Performed
- ✅ Directory navigation and breadcrumb functionality
- ✅ File editing with save/cancel operations
- ✅ File upload with multiple files
- ✅ Security boundary enforcement
- ✅ Error handling and user feedback
- ✅ UI/UX consistency with application design

## Usage

### Accessing the Feature
1. Open the Dispatch application
2. Click the Settings icon in the footer
3. Select the "Home Directory" tab (user icon)
4. Begin browsing and managing files

### File Operations
- **Browse**: Click on directories to navigate, use breadcrumbs to go back
- **Edit**: Click on files to open the editor, make changes, and save
- **Upload**: Use the upload button or drag-and-drop files
- **Create**: Use the new directory button to create folders

### Security Considerations
- All operations are restricted to the user's home directory
- Path traversal attempts are blocked by server-side validation
- File size limits prevent abuse of upload functionality
- Error messages provide appropriate feedback without exposing system details

## Files Changed

### New Files Created
- `src/routes/api/browse/home/+server.js` - Home directory browsing API
- `src/routes/api/files/home/+server.js` - Home directory file operations API
- `src/routes/api/files/home/upload/+server.js` - Home directory upload API
- `src/lib/client/shared/components/Settings/HomeDirectoryManager.svelte` - Main UI component
- `tests/server/home-directory-security.test.js` - Security tests

### Modified Files
- `src/lib/client/shared/components/Settings/SettingsModal.svelte` - Added new tab integration

## Conclusion

The Home Directory Manager successfully provides secure file management capabilities within the Dispatch application. The implementation follows security best practices, maintains UI/UX consistency, and provides comprehensive functionality for home directory management. All acceptance criteria have been met and the feature is ready for production use.