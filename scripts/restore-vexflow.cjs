#!/usr/bin/env node

/**
 * Script to restore original VexFlow files from backup.
 * This can be used if patches need to be removed or if there are issues.
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function findVexFlowPath() {
    let currentDir = process.cwd();
    
    const possiblePaths = [
        path.join(currentDir, 'node_modules', 'vexflow'),
        path.join(currentDir, '..', 'node_modules', 'vexflow'),
        path.join(currentDir, '..', '..', 'node_modules', 'vexflow'),
        path.join(currentDir, '..', '..', '..', 'node_modules', 'vexflow')
    ];
    
    for (const vexflowPath of possiblePaths) {
        if (fs.existsSync(vexflowPath) && fs.existsSync(path.join(vexflowPath, 'src'))) {
            return vexflowPath;
        }
    }
    
    return null;
}

function main() {
    log('🔄 OpenSheetMusicDisplay VexFlow Patch Restorer', 'blue');
    log('===============================================', 'blue');
    
    const vexflowPath = findVexFlowPath();
    if (!vexflowPath) {
        log('❌ VexFlow not found in node_modules', 'red');
        return;
    }
    
    const vexflowSrcPath = path.join(vexflowPath, 'src');
    const backupPath = path.join(path.dirname(vexflowSrcPath), 'src_backup_osmd');
    
    if (!fs.existsSync(backupPath)) {
        log('❌ No backup found. Cannot restore original VexFlow files.', 'red');
        return;
    }
    
    try {
        // Remove current src directory
        fs.rmSync(vexflowSrcPath, { recursive: true, force: true });
        
        // Restore from backup
        fs.cpSync(backupPath, vexflowSrcPath, { recursive: true });
        
        log('✅ Successfully restored original VexFlow files from backup', 'green');
        
    } catch (error) {
        log(`❌ Error restoring files: ${error.message}`, 'red');
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
