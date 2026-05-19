const fs = require('fs');
const path = require('path');

const wwwPath = path.join(__dirname, 'www');

// Clean www folder
if (fs.existsSync(wwwPath)) {
    fs.rmSync(wwwPath, { recursive: true, force: true });
}
fs.mkdirSync(wwwPath);

// Helper to copy file
function copyFile(src, dest) {
    fs.copyFileSync(src, dest);
}

// Helper to copy directory recursively
function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            copyFile(srcPath, destPath);
        }
    }
}

// Copy assets
copyFile(path.join(__dirname, 'index.html'), path.join(wwwPath, 'index.html'));
copyFile(path.join(__dirname, 'manifest.json'), path.join(wwwPath, 'manifest.json'));
copyFile(path.join(__dirname, 'sw.js'), path.join(wwwPath, 'sw.js'));

if (fs.existsSync(path.join(__dirname, 'css'))) {
    copyDir(path.join(__dirname, 'css'), path.join(wwwPath, 'css'));
}
if (fs.existsSync(path.join(__dirname, 'js'))) {
    copyDir(path.join(__dirname, 'js'), path.join(wwwPath, 'js'));
}
if (fs.existsSync(path.join(__dirname, 'icons'))) {
    copyDir(path.join(__dirname, 'icons'), path.join(wwwPath, 'icons'));
}

console.log('Build completed! Files copied to www/');
