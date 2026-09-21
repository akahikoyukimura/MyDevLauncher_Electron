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

// typically used in desktop frameworks like Electron to track the main application window
// BrowserWindow: An active window object (provided by Electron) containing all the window's properties and methods.
let mainWindow: BrowserWindow | null = null;

// Creates a key-value Map tracker. It stores active background processes so the app can track, read logs from, or kill them later
const processes = new Map<string, ChildProcess>();

// read projects json file and return the json
function loadProjects(): Project[] {
  const filePath = path.join(__dirname, "projects.json");

  const data = fs.readFileSync(filePath, "utf-8");

  return JSON.parse(data);
}
function writeProjects(projects: Project[]): void {
  const filePath = path.join(__dirname, "projects.json");
  fs.writeFileSync(
    filePath,

    JSON.stringify(projects, null, 4),

    "utf-8",
  );
}

// Create new window
function createWindow() {
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

// Waits until Electron has fully initialized internal system modules before binding IPC listeners or generating windows
app.whenReady().then(() => {
  // Registers IPC listener. When the frontend requests "get-projects", the main process reads projects.json and safely passes the array of projects back across the bridge.
  ipcMain.handle("get-projects", () => {
    return loadProjects();
  });

  // add project
  ipcMain.handle("add-project", async (_event, project) => {
    try {
      if (!project.id || !project.name || !project.path || !project.command) {
        return {
          success: false,

          message: "Please fill in all required fields.",
        };
      }
      const projects = loadProjects();
      const existingProjectPath = projects.find((p) => p.path === project.path);
      if (existingProjectPath) {
        //throw new Error("Another project found with the same path");
        return {
          success: false,

          message: "Another project found with the same path.",
        };
      }
      if (!fs.existsSync(project.path)) {
        return {
          success: false,

          message: `Directory does not exist: ${project.path}`,
        };
      }
      const existingProjectID = projects.find((item) => item.id === project.id.toLowerCase().replace(/\s+/g, '-'));

      if (existingProjectID) {
        return {
          success: false,

          message: `Project ID "${project.id}" already exists.`,
        };
      }
      projects.push({
        id: project.id.toLowerCase().replace(/\s+/g, '-'),

        name: project.name,

        path: project.path,

        command: project.command,

        args: Array.isArray(project.args) ? project.args : [],
      });
      writeProjects(projects);

      return {
        success: true,
        message: `${project.name} added`,
      };
    } catch (error) {
      console.error("Error adding project:", error);

      return {
        success: false,

        message: "Failed to add project.",
      };
    }
  });

  // Browse file
  ipcMain.handle("select-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // delete project
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

      if (processes.has(projectId)) {
        return {
          success: false,
          message: "Project is running, Please stop it before deleting",
        };
      }

      projects = projects.filter((project) => project.id !== projectId);
      writeProjects(projects);

      return {
        success: true,
        message: `Project ${project.name} deleted`,
      };
    } catch (error) {
      return {
        success: true,
        message: "Failed to delete project",
      };
    }
  });

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

    // Spawns a background process natively (e.g., executing npm run dev)
    const child = spawn(project.command, project.args, {
      cwd: project.path,
      shell: true,
      windowsHide: false,
    });

    // update the map structure to add the running proccess
    processes.set(projectId, child);

    // Listens to standard output (stdout) logs generated by the script. Whenever the script logs text, it converts the raw buffer data to a text string and pipes it directly to the frontend window via a custom "project-output" IPC channel so you can see it in a UI console.
    child.stdout?.on("data", (data) => {
      mainWindow?.webContents.send("project-output", {
        projectId,
        output: data.toString(),
      });
    });

    child.stderr?.on("data", (data) => {
      mainWindow?.webContents.send("project-output", {
        projectId,
        output: data.toString(),
      });
    });

    // Registers an event hook for when the background process exits naturally or gets terminated. It instantly clears the project's tracking footprint out of our global processes map
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

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
