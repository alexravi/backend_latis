#!/usr/bin/env node

/**
 * Change Analysis Script
 * Analyzes git changes and categorizes them for PR descriptions and release notes
 */

const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, '..', '.github', 'changelog-config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

/**
 * Check if a file path matches any pattern
 */
function matchesPattern(filePath, patterns) {
  return patterns.some(pattern => {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\//g, '\\/');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  });
}

/**
 * Check if file should be ignored
 */
function shouldIgnore(filePath) {
  return config.ignorePatterns.some(pattern => {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\//g, '\\/');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  });
}

/**
 * Categorize a file based on path and commit message
 */
function categorizeFile(filePath, commitMessage = '') {
  const message = commitMessage.toLowerCase();
  
  // Check each category
  for (const [categoryKey, category] of Object.entries(config.categories)) {
    // Check file patterns
    if (matchesPattern(filePath, category.patterns || [])) {
      return categoryKey;
    }
    
    // Check keywords in commit message
    if (category.keywords && category.keywords.some(keyword => message.includes(keyword))) {
      return categoryKey;
    }
  }
  
  // Default category for uncategorized files
  return 'other';
}

/**
 * Analyze git diff and categorize changes
 */
async function analyzeChanges(baseRef, headRef) {
  const git = simpleGit();
  
  try {
    // Get diff stats
    const diffSummary = await git.diffSummary([baseRef, headRef]);
    
    // Get list of changed files
    const changedFiles = await git.diff([baseRef, headRef, '--name-status']);
    
    // Parse changed files
    const files = changedFiles
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Handle rename (R<score> old new) and normal changes (A/M/D file)
        const renameMatch = line.match(/^R(\d+)\s+(.+?)\s+(.+)$/);
        if (renameMatch) {
          const [, score, oldPath, newPath] = renameMatch;
          return { status: 'R', filePath: newPath, oldPath: oldPath };
        }
        const match = line.match(/^([AMDR])\s+(.+)$/);
        if (!match) return null;
        const [, status, filePath] = match;
        return { status, filePath };
      })
      .filter(file => file && !shouldIgnore(file.filePath));
    
    // Get commit messages
    const log = await git.log({ from: baseRef, to: headRef });
    
    // Categorize changes
    const categorized = {
      feature: { files: [], added: 0, removed: 0 },
      fix: { files: [], added: 0, removed: 0 },
      database: { files: [], added: 0, removed: 0 },
      infrastructure: { files: [], added: 0, removed: 0 },
      documentation: { files: [], added: 0, removed: 0 },
      dependency: { files: [], added: 0, removed: 0 },
      test: { files: [], added: 0, removed: 0 },
      refactor: { files: [], added: 0, removed: 0 },
      other: { files: [], added: 0, removed: 0 }
    };
    
    // Process each file
    for (const file of files) {
      const commitMsg = log.all[0]?.message || '';
      const category = categorizeFile(file.filePath, commitMsg);
      
      // Get file stats from diff summary
      // Handle both old and new paths for renamed files
      const fileStats = diffSummary.files.find(f => 
        f.file === file.filePath || f.file === file.oldPath
      );
      
      if (fileStats) {
        const added = fileStats.insertions || 0;
        const removed = fileStats.deletions || 0;
        
        categorized[category].files.push({
          path: file.filePath,
          status: file.status,
          added: added,
          removed: removed,
          oldPath: file.oldPath || null
        });
        categorized[category].added += added;
        categorized[category].removed += removed;
      } else {
        // File might have no changes (just mode change) but still categorized
        categorized[category].files.push({
          path: file.filePath,
          status: file.status,
          added: 0,
          removed: 0,
          oldPath: file.oldPath || null
        });
      }
    }
    
    // Calculate totals
    const totalFiles = files.length;
    const totalAdded = diffSummary.insertions || 0;
    const totalRemoved = diffSummary.deletions || 0;
    
    return {
      categorized,
      totalFiles,
      totalAdded,
      totalRemoved,
      commits: log.all.length
    };
  } catch (error) {
    console.error('Error analyzing changes:', error);
    throw error;
  }
}

/**
 * Generate PR description markdown
 */
function generatePRDescription(analysis) {
  const { categorized, totalFiles, totalAdded, totalRemoved, commits } = analysis;
  
  let markdown = `## 📋 Change Summary\n\n`;
  markdown += `- **Total Files Changed**: ${totalFiles}\n`;
  markdown += `- **Lines Added**: +${totalAdded}\n`;
  markdown += `- **Lines Removed**: -${totalRemoved}\n`;
  markdown += `- **Commits**: ${commits}\n\n`;
  markdown += `---\n\n`;
  
  // Generate sections for each category
  for (const [categoryKey, category] of Object.entries(config.categories)) {
    const changes = categorized[categoryKey];
    
    if (changes.files.length > 0) {
      markdown += `### ${category.emoji} ${category.label}\n\n`;
      
      if (config.outputFormat.includeStats) {
        markdown += `- **Files**: ${changes.files.length}\n`;
        markdown += `- **Added**: +${changes.added} lines\n`;
        markdown += `- **Removed**: -${changes.removed} lines\n\n`;
      }
      
      if (config.outputFormat.includeFileList && changes.files.length <= config.outputFormat.maxFilesListed) {
        markdown += `**Changed Files:**\n`;
        changes.files.forEach(file => {
          const statusEmoji = {
            'A': '➕',
            'M': '📝',
            'D': '🗑️',
            'R': '🔄'
          }[file.status] || '📄';
          if (file.status === 'R' && file.oldPath) {
            markdown += `- ${statusEmoji} \`${file.oldPath}\` → \`${file.filePath}\` (+${file.added}/-${file.removed})\n`;
          } else {
            markdown += `- ${statusEmoji} \`${file.filePath}\` (+${file.added}/-${file.removed})\n`;
          }
        });
        markdown += `\n`;
      }
    }
  }
  
  // Show other category if there are uncategorized files
  if (categorized.other.files.length > 0) {
    markdown += `### 📄 Other Changes\n\n`;
    markdown += `**Files:**\n`;
    categorized.other.files.forEach(file => {
      const statusEmoji = {
        'A': '➕',
        'M': '📝',
        'D': '🗑️',
        'R': '🔄'
      }[file.status] || '📄';
      markdown += `- ${statusEmoji} \`${file.filePath}\` (+${file.added}/-${file.removed})\n`;
    });
    markdown += `\n`;
  }
  
  return markdown;
}

/**
 * Generate release notes markdown
 */
function generateReleaseNotes(analysis, version = null) {
  const { categorized, totalFiles, totalAdded, totalRemoved, commits } = analysis;
  
  let markdown = version ? `# Release ${version}\n\n` : `# Release Notes\n\n`;
  
  markdown += `## Summary\n\n`;
  markdown += `This release includes ${totalFiles} file changes across ${commits} commits.\n\n`;
  markdown += `- **Lines Added**: +${totalAdded}\n`;
  markdown += `- **Lines Removed**: -${totalRemoved}\n\n`;
  markdown += `---\n\n`;
  
  // Generate sections for each category
  for (const [categoryKey, category] of Object.entries(config.categories)) {
    const changes = categorized[categoryKey];
    
    if (changes.files.length > 0) {
      markdown += `## ${category.emoji} ${category.label}\n\n`;
      
      // Group by type (added/modified/deleted)
      const added = changes.files.filter(f => f.status === 'A');
      const modified = changes.files.filter(f => f.status === 'M');
      const deleted = changes.files.filter(f => f.status === 'D');
      
      const renamed = changes.files.filter(f => f.status === 'R');
      
      if (added.length > 0) {
        markdown += `### Added\n\n`;
        added.forEach(file => {
          markdown += `- Added \`${file.filePath}\`\n`;
        });
        markdown += `\n`;
      }
      
      if (modified.length > 0) {
        markdown += `### Modified\n\n`;
        modified.slice(0, config.outputFormat.maxFilesListed).forEach(file => {
          markdown += `- Updated \`${file.filePath}\` (+${file.added}/-${file.removed})\n`;
        });
        if (modified.length > config.outputFormat.maxFilesListed) {
          markdown += `- ... and ${modified.length - config.outputFormat.maxFilesListed} more files\n`;
        }
        markdown += `\n`;
      }
      
      if (renamed.length > 0) {
        markdown += `### Renamed\n\n`;
        renamed.forEach(file => {
          if (file.oldPath) {
            markdown += `- Renamed \`${file.oldPath}\` → \`${file.filePath}\`\n`;
          } else {
            markdown += `- Renamed \`${file.filePath}\`\n`;
          }
        });
        markdown += `\n`;
      }
      
      if (deleted.length > 0) {
        markdown += `### Removed\n\n`;
        deleted.forEach(file => {
          markdown += `- Removed \`${file.filePath}\`\n`;
        });
        markdown += `\n`;
      }
    }
  }
  
  // Show other category if there are uncategorized files
  if (categorized.other.files.length > 0) {
    markdown += `## 📄 Other Changes\n\n`;
    categorized.other.files.forEach(file => {
      const statusEmoji = {
        'A': '➕',
        'M': '📝',
        'D': '🗑️',
        'R': '🔄'
      }[file.status] || '📄';
      if (file.status === 'R' && file.oldPath) {
        markdown += `- ${statusEmoji} \`${file.oldPath}\` → \`${file.filePath}\`\n`;
      } else {
        markdown += `- ${statusEmoji} \`${file.filePath}\`\n`;
      }
    });
    markdown += `\n`;
  }
  
  return markdown;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const outputType = args[0] || 'pr'; // 'pr' or 'release'
  const baseRef = args[1] || 'HEAD~1';
  const headRef = args[2] || 'HEAD';
  const version = args[3] || null;
  
  try {
    const analysis = await analyzeChanges(baseRef, headRef);
    
    let output;
    if (outputType === 'release') {
      output = generateReleaseNotes(analysis, version);
    } else {
      output = generatePRDescription(analysis);
    }
    
    // Output to stdout (for GitHub Actions)
    console.log(output);
    
    // Also write to file if specified
    if (process.env.OUTPUT_FILE) {
      fs.writeFileSync(process.env.OUTPUT_FILE, output, 'utf8');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { analyzeChanges, generatePRDescription, generateReleaseNotes };
