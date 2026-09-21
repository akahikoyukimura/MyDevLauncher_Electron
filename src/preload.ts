import { contextBridge, ipcRenderer } from "electron";
import { Project } from "./main";

// contextBridge: The security module used to safely expose APIs from this script to your frontend webpage.
contextBridge.exposeInMainWorld("launcher", {
  // ipcRenderer: The communication module used to send messages to, and receive messages from, the main background process (main.ts)
  getProjects: () => {
    return ipcRenderer.invoke("get-projects");
  },

  //     clearTreminal: () => {
  //     return ipcRenderer.invoke("clear-terminal");
  // },

  addProject: (project: Project) => {
    return ipcRenderer.invoke("add-project", project);
  },

  selectFolder: () => {
    return ipcRenderer.invoke("select-folder");
  },

  deleteProject: (projectId: string) => {
    return ipcRenderer.invoke("delete-project", projectId);
  },

  startProject: (projectId: string) => {
    return ipcRenderer.invoke("start-project", projectId);
  },

  stopProject: (projectId: string) => {
    return ipcRenderer.invoke("stop-project", projectId);
  },

  onOutput: (callback: (data: any) => void) => {
    ipcRenderer.on("project-output", (_event, data) => callback(data));
  },

  onStopped: (callback: (data: any) => void) => {
    ipcRenderer.on("project-stopped", (_event, data) => callback(data));
  },
});
