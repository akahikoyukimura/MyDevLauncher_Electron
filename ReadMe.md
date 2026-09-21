# 🚀 Core Electron Methods Reference

A quick-reference guide to the most essential methods in the **Electron framework**, organized by process and module.

---

## 🟢 1. Main Process: Core Application Lifecycle
These methods manage the system-level behavior of your desktop application.

### `app` Module

| Method | Description | Implementation Example |
| :--- | :--- | :--- |
| **`app.whenReady()`** | Returns a `Promise` that resolves when Electron finishes initializing. Safely trigger windows here. | `app.whenReady().then(createWindow);` |
| **`app.quit()`** | Closes all open windows and completely terminates the application process. | `app.quit();` |
| **`app.getPath(name)`** | Fetches absolute system paths (e.g., `'home'`, `'appData'`, `'downloads'`). | `app.getPath('userData');` |

> [!IMPORTANT]
> Always wrap your window creation logic inside `app.whenReady()`. Calling `new BrowserWindow()` before initialization will throw a runtime crash.

---

## 🪟 2. Main Process: Window Management
Methods used to spin up, control, and manipulate native operating system windows.

### `BrowserWindow` Module
```javascript
const { BrowserWindow } = require('electron');

// Create a window instance
const win = new BrowserWindow({ width: 800, height: 600 });

// 1. Load your local interface
win.loadFile('index.html'); 

// 2. Load a remote URL (Alternative)
win.loadURL('https://github.com'); 

// 3. Open Developer Tools for debugging
win.webContents.openDevTools(); 

// 4. Force close the window programmatically
win.close();
```

---

## 🔄 3. Inter-Process Communication (IPC)
The critical bridge between your backend (Main Process) and your UI frontend (Renderer Process).

### Communication Pattern Matrix

| Module | Method | Direction | Communication Type |
| :--- | :--- | :--- | :--- |
| **`ipcMain`** | `ipcMain.handle(channel, cb)` | Listens for Renderer | Asynchronous (Two-Way) |
| **`ipcMain`** | `ipcMain.on(channel, cb)` | Listens for Renderer | One-Way Fire-and-Forget |
| **`ipcRenderer`** | `ipcRenderer.invoke(channel, args)` | Sends to Main | Asynchronous (Expects Return Value) |
| **`ipcRenderer`** | `ipcRenderer.send(channel, args)` | Sends to Main | One-Way Fire-and-Forget |

> [!TIP]
> **Best Practice:** Use `ipcRenderer.invoke()` combined with `ipcMain.handle()`. It natively supports `async/await` and eliminates messy callback configurations.

### Code Implementation

<details>
<summary><b>👁️ Click to view clean IPC Bridge Setup Example</b></summary>

```javascript
// main.js (Main Process)
ipcMain.handle('perform-heavy-task', async (event, data) => {
  const result = await heavyCalculation(data);
  return result; // Returned straight to the renderer
});

// preload.js (The Secure Bridge)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  runTask: (data) => ipcRenderer.invoke('perform-heavy-task', data)
});
```
</details>

---

## 📁 4. Main Process: Native System Dialogs
Methods to invoke standard operating system prompt panels.

### `dialog` Module
* **`dialog.showOpenDialog(options)`**: Opens a native file/folder selector. Returns a list of paths chosen by the user.
* **`dialog.showSaveDialog(options)`**: Displays an interface allowing users to select a path to write a file.
* **`dialog.showMessageBox(options)`**: Shows highly visible popup system alert dialogues with interactive buttons.

> [!WARNING]
> Native dialogs block operational execution UI threads if called synchronously. Always use the modern, non-blocking asynchronous Promise patterns shown below:

```javascript
const openFileSelector = async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections']
  });
  if (!canceled) return filePaths;
};
```

---

## 🌐 5. Shared Utility: Desktop Integrations
Methods executable anywhere to hook into OS-specific behaviors.

### `shell` Module
* **`shell.openExternal(url)`**: Spawns user's default external web browser (Chrome, Safari, etc.) to view a URL instead of opening it inside your app window.
* **`shell.showItemInFolder(fullPath)`**: Spawns native file explorer panels (Finder/Explorer) with a highlighted file focus.

__________________________________________________________________________________
### Callback
- A callback is simply a function passed as an argument into another function, to be executed (called back) later
- Instead of a function executing immediately and returning a value, it waits for an event, a timer, or a long-running task to finish before it runs.

__________________________________________________________________________________
- build project : npm run build
- start it localy : npm start
- build the exec : npm run dist

__________________________________________________________________________________
json structure :
``` 
    {
        "id": "test-f",
        "name": "test",
        "path": "C:\\test\\test\\test",
        "command": "npm",
        "args": [
            "test"
        ]
    }
```