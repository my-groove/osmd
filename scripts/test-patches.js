#!/usr/bin/env node

/**
 * Test script to verify VexFlow patches are applied correctly
 */

const fs = require('fs');
const path = require('path');
const { findVexFlowPath, findOSMDPath } = require('./apply-vexflow-patches.js');

function log(message, color = 'reset') {
    const colors = {
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        reset: '\x1b[0m'
    };
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function testPatchPresence() {
    log('🧪 Testing VexFlow Patch Application', 'blue');
    log('===================================', 'blue');
    
    const vexflowPath = findVexFlowPath();
    if (!vexflowPath) {
        log('❌ VexFlow not found', 'red');
        return false;
    }
    
    const osmdPath = findOSMDPath();
    if (!osmdPath) {
        log('❌ OSMD patches not found', 'red');
        return false;
    }
    
    log(`✅ VexFlow found at: ${vexflowPath}`, 'green');
    log(`✅ OSMD patches found at: ${osmdPath}`, 'green');
    
    // Test a few key patch files
    const testFiles = [
        'articulation.js',
        'formatter.js',
        'stavenote.js',
        'svgcontext.js'
    ];
    
    let patchedFiles = 0;
    let totalFiles = 0;
    
    for (const testFile of testFiles) {
        const vexflowFile = path.join(vexflowPath, 'src', testFile);
        const patchFile = path.join(osmdPath, 'src', 'VexFlowPatch', 'src', testFile);
        
        totalFiles++;
        
        if (fs.existsSync(vexflowFile) && fs.existsSync(patchFile)) {
            try {
                const vexflowContent = fs.readFileSync(vexflowFile, 'utf8');
                const patchContent = fs.readFileSync(patchFile, 'utf8');
                
                // Check if the content matches (indicating patch was applied)
                if (vexflowContent === patchContent) {
                    log(`  ✅ ${testFile} - Patch applied correctly`, 'green');
                    patchedFiles++;
                } else {
                    // Check for VexFlowPatch comments as evidence of patching
                    if (vexflowContent.includes('VexFlowPatch')) {
                        log(`  ✅ ${testFile} - Contains patch markers`, 'green');
                        patchedFiles++;
                    } else {
                        log(`  ⚠️  ${testFile} - Content differs, may not be patched`, 'yellow');
                    }
                }
            } catch (error) {
                log(`  ❌ ${testFile} - Error reading file: ${error.message}`, 'red');
            }
        } else {
            log(`  ❌ ${testFile} - Missing file(s)`, 'red');
        }
    }
    
    const successRate = (patchedFiles / totalFiles) * 100;
    log(`\n📊 Patch Status: ${patchedFiles}/${totalFiles} files verified (${successRate.toFixed(1)}%)`, 
        successRate > 75 ? 'green' : successRate > 50 ? 'yellow' : 'red');
    
    // Check for backup
    const backupPath = path.join(vexflowPath, 'src_backup_osmd');
    if (fs.existsSync(backupPath)) {
        log('✅ Backup directory exists', 'green');
    } else {
        log('⚠️  No backup directory found', 'yellow');
    }
    
    return successRate > 75;
}

if (require.main === module) {
    const success = testPatchPresence();
    process.exit(success ? 0 : 1);
}

module.exports = { testPatchPresence };
