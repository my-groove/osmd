#!/usr/bin/env node

/**
 * Script to apply VexFlow patches when opensheetmusicdisplay is installed as a dependency.
 * This script finds the VexFlow installation in the consuming project and applies the necessary patches.
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
    // Start from the current working directory (the consuming project)
    let currentDir = process.cwd();
    
    // Look for vexflow in node_modules at various levels
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

function findOSMDPath() {
    // Try to find this package (opensheetmusicdisplay) in node_modules
    let currentDir = process.cwd();
    
    const possiblePaths = [
        path.join(currentDir, 'node_modules', 'opensheetmusicdisplay'),
        path.join(__dirname, '..'), // If running from within the package
    ];
    
    for (const osmdPath of possiblePaths) {
        if (fs.existsSync(path.join(osmdPath, 'src', 'VexFlowPatch', 'src'))) {
            return osmdPath;
        }
    }
    
    return null;
}

function copyFile(source, destination) {
    try {
        const sourceContent = fs.readFileSync(source, 'utf8');
        fs.writeFileSync(destination, sourceContent, 'utf8');
        return true;
    } catch (error) {
        log(`Error copying file ${source} to ${destination}: ${error.message}`, 'red');
        return false;
    }
}

function copyDirectory(sourceDir, destDir) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    
    const items = fs.readdirSync(sourceDir);
    let copiedFiles = 0;
    
    for (const item of items) {
        const sourcePath = path.join(sourceDir, item);
        const destPath = path.join(destDir, item);
        
        if (fs.statSync(sourcePath).isDirectory()) {
            copiedFiles += copyDirectory(sourcePath, destPath);
        } else if (path.extname(item) === '.js') {
            if (copyFile(sourcePath, destPath)) {
                copiedFiles++;
                log(`  ✓ Patched: ${item}`, 'green');
            }
        }
    }
    
    return copiedFiles;
}

function checkVexFlowVersion(vexflowPath) {
    try {
        const packageJsonPath = path.join(vexflowPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            return packageJson.version;
        }
    } catch (error) {
        log(`Warning: Could not read VexFlow version: ${error.message}`, 'yellow');
    }
    return 'unknown';
}

function createBackup(vexflowSrcPath) {
    const backupPath = path.join(path.dirname(vexflowSrcPath), 'src_backup_osmd');
    
    if (!fs.existsSync(backupPath)) {
        try {
            // Create backup of original VexFlow src
            fs.cpSync(vexflowSrcPath, backupPath, { recursive: true });
            log(`✓ Created backup at: ${backupPath}`, 'blue');
            return true;
        } catch (error) {
            log(`Warning: Could not create backup: ${error.message}`, 'yellow');
            return false;
        }
    } else {
        log(`✓ Backup already exists at: ${backupPath}`, 'blue');
        return true;
    }
}

function main() {
    log('🎵 OpenSheetMusicDisplay VexFlow Patch Installer', 'blue');
    log('================================================', 'blue');
    
    // Skip if we're installing the package itself (not as a dependency)
    if (process.env.npm_package_name === 'opensheetmusicdisplay') {
        log('Skipping patch application - running within opensheetmusicdisplay package itself', 'yellow');
        return;
    }
    
    // Find VexFlow installation
    const vexflowPath = findVexFlowPath();
    if (!vexflowPath) {
        log('⚠️  VexFlow not found in node_modules. Patches will not be applied.', 'yellow');
        log('   Make sure VexFlow is installed as a dependency in your project.', 'yellow');
        return;
    }
    
    const vexflowVersion = checkVexFlowVersion(vexflowPath);
    log(`📦 Found VexFlow ${vexflowVersion} at: ${vexflowPath}`, 'green');
    
    // Warn about version compatibility
    if (vexflowVersion !== '1.2.93' && vexflowVersion !== 'unknown') {
        log(`⚠️  Warning: These patches are designed for VexFlow 1.2.93, but found ${vexflowVersion}`, 'yellow');
        log('   The patches may not work correctly with this version.', 'yellow');
    }
    
    // Find OSMD patches
    const osmdPath = findOSMDPath();
    if (!osmdPath) {
        log('❌ Could not find OpenSheetMusicDisplay patches directory', 'red');
        return;
    }
    
    const patchesPath = path.join(osmdPath, 'src', 'VexFlowPatch', 'src');
    log(`📂 Found patches at: ${patchesPath}`, 'green');
    
    // Create backup
    const vexflowSrcPath = path.join(vexflowPath, 'src');
    createBackup(vexflowSrcPath);
    
    // Apply patches
    log('\n🔧 Applying VexFlow patches...', 'blue');
    const copiedFiles = copyDirectory(patchesPath, vexflowSrcPath);
    
    if (copiedFiles > 0) {
        log(`\n✅ Successfully applied ${copiedFiles} VexFlow patches!`, 'green');
        log('\n📝 Note: These patches are required for OpenSheetMusicDisplay to function correctly.', 'blue');
        log('   If you update VexFlow, you may need to reinstall opensheetmusicdisplay.', 'blue');
    } else {
        log('\n❌ No patches were applied. This may cause issues with OpenSheetMusicDisplay.', 'red');
    }
}

if (require.main === module) {
    main();
}

module.exports = { main, findVexFlowPath, findOSMDPath };
