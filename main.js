const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let pyProc = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("frontend/build/index.html");
}

app.whenReady().then(() => {
  // Start Python backend
  pyProc = spawn("python", ["backend/main.py"]);
  createWindow();
});

app.on("window-all-closed", () => {
  if (pyProc) pyProc.kill();
  if (process.platform !== "darwin") app.quit();
});
