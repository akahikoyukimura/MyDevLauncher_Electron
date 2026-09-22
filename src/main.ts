import { app, BrowserWindow, dialog, ipcMain } from "electron";

import { spawn, ChildProcess } from "child_process";

import * as path from "path";
import * as fs from "fs";

export interface Project {
  id: string;
  name: string;
  path: string;
  command: string;
  args: string[];
}

// ============================================================
// Main Window
// ============================================================
// typically used in desktop frameworks like Electron to track the main application window
// BrowserWindow: An active window object (provided by Electron) containing all the window's properties and methods.

let mainWindow: BrowserWindow | null = null;

// ============================================================
// Running Processes
// ============================================================
// Creates a key-value Map tracker. It stores active background processes so the app can track, read logs from, or kill them later
const processes = new Map<string, ChildProcess>();

// ============================================================
// Projects JSON paths
// ============================================================

// Default projects.json bundled with the application.
//
// This file is READ ONLY after packaging.
// It is only used to initialize the user's projects.json
// the first time the application is launched.
const defaultProjectsPath = path.join(__dirname, "projects.json");

// User's writable projects.json.
//
// This is the important path.
//
// Development:
// C:\Users\<user>\AppData\Roaming\My Dev Launcher\projects.json
//
// Packaged:
// C:\Users\<user>\AppData\Roaming\My Dev Launcher\projects.json
//
const userProjectsPath = path.join(app.getPath("userData"), "projects.json");

// ============================================================
// Initialize user projects.json
// ============================================================

function initializeProjectsFile(): void {
  const userDataDirectory = app.getPath("userData");

  // Make sure the userData directory exists.
  if (!fs.existsSync(userDataDirectory)) {
    fs.mkdirSync(userDataDirectory, {
      recursive: true,
    });
  }

  // If the user already has a projects.json,
  // DO NOT overwrite it.
  //
  // This is very important because this file contains
  // the user's added projects.
  if (fs.existsSync(userProjectsPath)) {
    return;
  }

  // First launch:
  //
  // Copy the default projects.json bundled
  // with the application.
  if (fs.existsSync(defaultProjectsPath)) {
    fs.copyFileSync(defaultProjectsPath, userProjectsPath);

    return;
  }

  // If there is no default projects.json,
  // create an empty one.
  fs.writeFileSync(userProjectsPath, JSON.stringify([], null, 4), "utf-8");
}

// ============================================================
// Load Projects
// ============================================================
// read projects json file and return the json
function loadProjects(): Project[] {
  initializeProjectsFile();
  const data = fs.readFileSync(userProjectsPath, "utf-8");
  return JSON.parse(data);
}

// ============================================================
// Save Projects
// ============================================================

function writeProjects(projects: Project[]): void {
  fs.writeFileSync(
    userProjectsPath,
    JSON.stringify(projects, null, 4),
    "utf-8",
  );
}

// ============================================================
// Create Main Window
// ============================================================

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 700,
    minHeight: 500,
    // Configures security settings for the window
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Loads the HTML interface file
  mainWindow.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

// ============================================================
// Electron Ready
// ============================================================
// Waits until Electron has fully initialized internal system modules before binding IPC listeners or generating windows
app.whenReady().then(() => {
  // Make sure the user's projects.json exists.
  initializeProjectsFile();

  // ==========================================================
  // GET PROJECTS
  // ==========================================================

  // Registers IPC listener. When the frontend requests "get-projects", the main process reads projects.json and safely passes the array of projects back across the bridge.
  ipcMain.handle("get-projects", () => {
    return loadProjects();
  });

  // ==========================================================
  // ADD PROJECT
  // ==========================================================

  ipcMain.handle("add-project", async (_event, project) => {
    try {
      // ------------------------------------------
      // Validate required fields
      // ------------------------------------------
      if (!project.id || !project.name || !project.path || !project.command) {
        return {
          success: false,
          message: "Please fill in all required fields.",
        };
      }
      // ------------------------------------------
      // Load existing projects
      // ------------------------------------------
      const projects = loadProjects();
      // ------------------------------------------
      // Check duplicate path
      // ------------------------------------------
      const existingProjectPath = projects.find((p) => p.path === project.path);

      if (existingProjectPath) {
        return {
          success: false,
          message: "Another project found with the same path.",
        };
      }

      // ------------------------------------------
      // Check directory
      // ------------------------------------------

      if (!fs.existsSync(project.path)) {
        return {
          success: false,
          message: `Directory does not exist: ${project.path}`,
        };
      }

      // ------------------------------------------
      // Normalize project ID
      // ------------------------------------------

      const normalizedId = project.id.toLowerCase().replace(/\s+/g, "-");

      // ------------------------------------------
      // Check duplicate ID
      // ------------------------------------------

      const existingProjectID = projects.find(
        (item) => item.id === normalizedId,
      );

      if (existingProjectID) {
        return {
          success: false,
          message: `Project ID "${project.id}" already exists.`,
        };
      }

      // ------------------------------------------
      // Add project
      // ------------------------------------------

      projects.push({
        id: normalizedId,
        name: project.name,
        path: project.path,
        command: project.command,
        args: Array.isArray(project.args) ? project.args : [],
      });

      // ------------------------------------------
      // Save
      // ------------------------------------------

      writeProjects(projects);
      return {
        success: true,
        message: `${project.name} added`,
      };
    } catch (error) {
      console.error("Error adding project:", error);
      return {
        success: false,
        message: `${error}`,
      };
    }
  });

  // ==========================================================
  // SELECT FOLDER
  // ==========================================================

  ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  // ==========================================================
  // DELETE PROJECT
  // ==========================================================

  ipcMain.handle("delete-project", async (_event, projectId: string) => {
    try {
      let projects = loadProjects();
      const project = projects.find((p) => p.id === projectId);
      if (!project) {
        return {
          success: false,
          message: "Project not found",
        };
      }

      // ------------------------------------------
      // Don't delete running project
      // ------------------------------------------

      if (processes.has(projectId)) {
        return {
          success: false,
          message: "Project is running, Please stop it before deleting",
        };
      }

      // ------------------------------------------
      // Remove project
      // ------------------------------------------

      projects = projects.filter((project) => project.id !== projectId);

      // ------------------------------------------
      // Save
      // ------------------------------------------

      writeProjects(projects);
      return {
        success: true,
        message: `Project ${project.name} deleted`,
      };
    } catch (error) {
      console.error("Failed to delete project:", error);
      return {
        success: false,
        message: "Failed to delete project",
      };
    }
  });

  // ==========================================================
  // START PROJECT
  // ==========================================================

  // _event: The first argument is always the Electron IPC event object (which contains metadata like which window sent the request)
  ipcMain.handle("start-project", async (_event, projectId: string) => {
    const projects = loadProjects();
    const project = projects.find((p) => p.id === projectId);
    if (!project) {
      throw new Error("Project not found");
    }
    if (processes.has(projectId)) {
      return {
        success: false,
        message: "Project is already running",
      };
    }
    if (!fs.existsSync(project.path)) {
      return {
        success: false,
        message: `Directory does not exist: ${project.path}`,
      };
    }

    // ------------------------------------------
    // Start project
    // ------------------------------------------

    // Spawns a background process natively (e.g., executing npm run dev)
    const child = spawn(project.command, project.args, {
      cwd: project.path,
      shell: true,
      windowsHide: false,
    });

    // update the map structure to add the running proccess
    processes.set(projectId, child);

    // ------------------------------------------
    // stdout
    // ------------------------------------------

    // Listens to standard output (stdout) logs generated by the script. Whenever the script logs text, it converts the raw buffer data to a text string and pipes it directly to the frontend window via a custom "project-output" IPC channel so you can see it in a UI console.
    child.stdout?.on("data", (data) => {
      mainWindow?.webContents.send("project-output", {
        projectId,
        output: data.toString(),
      });
    });

    // ------------------------------------------
    // stderr
    // ------------------------------------------

    child.stderr?.on("data", (data) => {
      mainWindow?.webContents.send("project-output", {
        projectId,
        output: data.toString(),
      });
    });

    // ------------------------------------------
    // Process closed
    // ------------------------------------------

    child.on("close", (code) => {
      processes.delete(projectId);
      mainWindow?.webContents.send("project-stopped", {
        projectId,
        code,
      });
    });

    return {
      success: true,
      message: `${project.name} started`,
    };
  });

  // ==========================================================
  // STOP PROJECT
  // ==========================================================

  ipcMain.handle("stop-project", async (_event, projectId: string) => {
    const child = processes.get(projectId);
    if (!child) {
      return {
        success: false,
        message: "Project is not running",
      };
    }
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        shell: true,
      });
    } else {
      child.kill("SIGTERM");
    }
    processes.delete(projectId);
    return {
      success: true,
      message: "Project stopped",
    };
  });

  // ==========================================================
  // CREATE WINDOW
  // ==========================================================

  createWindow();

  // ==========================================================
  // macOS
  // ==========================================================

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// ============================================================
// Close Application
// ============================================================

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
