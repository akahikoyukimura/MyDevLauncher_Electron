const projectsContainer = document.getElementById("projects");

const output = document.getElementById("output");

const projectCount = document.getElementById("project-count");

const addProjectButton = document.getElementById("add-project");

const deleteProjectButton = document.getElementById("delete-project");

const projectModal = document.getElementById("project-modal");

const closeDeleteModalButton = document.getElementById("close-delete-modal");

const confirmDeleteProjectButton = document.getElementById(
  "confirm-delete-project",
);

const deleteModal = document.getElementById("delete-modal");

const closeModalButton = document.getElementById("close-modal");

const cancelProjectButton = document.getElementById("cancel-project");

const addProjectForm = document.getElementById("add-project-form");

const browseProjectButton = document.getElementById("browse-project");

const formError = document.getElementById("form-error");
let projectToDelete = null;

/* =========================================
   CLEAR OUTPUT
========================================= */

function clearOutput() {
  output.textContent = "";
}

/* =========================================
   RUNNING PROJECTS
========================================= */

const runningProjects = new Set();

/* =========================================
   LOAD PROJECTS
========================================= */

async function loadProjects() {
  try {
    const projects = await window.launcher.getProjects();

    projectsContainer.innerHTML = "";

    /* Update project count */

    projectCount.textContent = `${projects.length} ${
      projects.length === 1 ? "Project" : "Projects"
    }`;

    /* =====================================
           CREATE PROJECT CARDS
        ===================================== */

    projects.forEach((project) => {
      const element = document.createElement("div");

      element.className = "project";

      element.innerHTML = `

<div class="card">
<div>
                <div class="project-info">

                    <div class="project-name">

                        ${escapeHtml(project.name)}

                    </div>


                    <div class="project-path">

                        ${escapeHtml(project.path)}

                    </div>

                </div>


                <div class="project-controls">

                    <button
                        class="run"
                        data-id="${escapeHtml(project.id)}"
                    >

                        ▶ Run

                    </button>


                    <button
                        class="stop"
                        data-id="${escapeHtml(project.id)}"
                    >

                        ■ Stop

                    </button>


                    <span
                        class="status stopped"
                        id="status-${escapeHtml(project.id)}"
                    >

                        Stopped

                    </span>

                </div>
</div>
<button id="delete-project" class="delete" data-id="${escapeHtml(project.id)}"><span >🗑 </span></button>
</div>

            `;

      projectsContainer.appendChild(element);
    });

    /* =====================================
           DELETE BUTTONS
        ===================================== */

    document.querySelectorAll(".delete").forEach((button) => {
      button.addEventListener("click", () => {
        projectToDelete = button.dataset.id;
        //deleteProject(button.dataset.id);
        openDeleteProjectModal();
      });
    });

    /* =====================================
           RUN BUTTONS
        ===================================== */

    document.querySelectorAll(".run").forEach((button) => {
      button.addEventListener("click", () => {
        startProject(button.dataset.id);
      });
    });

    /* =====================================
           STOP BUTTONS
        ===================================== */

    document.querySelectorAll(".stop").forEach((button) => {
      button.addEventListener("click", () => {
        stopProject(button.dataset.id);
      });
    });
  } catch (error) {
    console.error("Failed to load projects:", error);

    output.textContent += "Failed to load projects.\n";
  }
}

/* =========================================
   DELETE PROJECT
========================================= */

async function deleteProject(projectId) {
  output.scrollTop = output.scrollHeight;

  const result = await window.launcher.deleteProject(projectId);

  output.textContent += `${result.message}\n\n`;
  await loadProjects();
}

/* =========================================
   START PROJECT
========================================= */

async function startProject(projectId) {
  output.textContent += `Starting ${projectId}...\n`;

  output.scrollTop = output.scrollHeight;

  const result = await window.launcher.startProject(projectId);

  output.textContent += `${result.message}\n\n`;

  output.scrollTop = output.scrollHeight;

  if (result.success) {
    runningProjects.add(projectId);

    updateStatus(projectId, true);
  }
}

/* =========================================
   STOP PROJECT
========================================= */

async function stopProject(projectId) {
  const result = await window.launcher.stopProject(projectId);

  output.textContent += `${result.message}\n`;

  output.scrollTop = output.scrollHeight;

  if (result.success) {
    runningProjects.delete(projectId);

    updateStatus(projectId, false);
  }
}

/* =========================================
   UPDATE STATUS
========================================= */

function updateStatus(projectId, running) {
  const status = document.getElementById(`status-${projectId}`);

  if (!status) {
    return;
  }

  if (running) {
    status.textContent = "Running";

    status.className = "status running";
  } else {
    status.textContent = "Stopped";

    status.className = "status stopped";
  }
}

/* =========================================
   LIVE PROJECT OUTPUT
========================================= */

window.launcher.onOutput((data) => {
  output.textContent += data.output;

  output.scrollTop = output.scrollHeight;
});

/* =========================================
   PROJECT STOPPED EVENT
========================================= */

window.launcher.onStopped((data) => {
  runningProjects.delete(data.projectId);

  updateStatus(data.projectId, false);

  output.textContent += `\nProject stopped (code ${data.code})\n`;

  output.scrollTop = output.scrollHeight;
});

/* =========================================
   OPEN ADD PROJECT MODAL
========================================= */

function openProjectModal() {
  projectModal.classList.add("active");

  document.getElementById("project-id").focus();
}

/* =========================================
   CLOSE ADD PROJECT MODAL
========================================= */

function closeProjectModal() {
  projectModal.classList.remove("active");

  addProjectForm.reset();

  /*
   * Restore default command
   */

  document.getElementById("project-command").value = "npm";

  formError.textContent = "";

  formError.classList.remove("visible");
}

/* =========================================
   OPEN MODAL
========================================= */

addProjectButton.addEventListener("click", openProjectModal);

/* =========================================
   CLOSE MODAL
========================================= */

closeModalButton.addEventListener("click", closeProjectModal);

cancelProjectButton.addEventListener("click", closeProjectModal);

/* =========================================
   CLICK OUTSIDE MODAL
========================================= */

projectModal.addEventListener("click", (event) => {
  if (event.target === projectModal) {
    closeProjectModal();
  }
});

/* =========================================
   ESCAPE KEY
========================================= */

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && projectModal.classList.contains("active")) {
    closeProjectModal();
  }
});

/* =========================================
   OPEN DELETE PROJECT MODAL
========================================= */

function openDeleteProjectModal() {
  deleteModal.classList.add("active");
  document.getElementById("object-to-delete").textContent =
    `${projectToDelete}`;
}

/* =========================================
   CLOSE DELETE PROJECT MODAL
========================================= */

function closeDeleteProjectModal() {
  deleteModal.classList.remove("active");
}

/* =========================================
   CONFIRM DELETE PROJECT 
========================================= */

function confirmDeleteProject() {
  deleteProject(projectToDelete);
  projectToDelete = null;
  deleteModal.classList.remove("active");
}

/* =========================================
   OPEN DELETE MODAL
========================================= */

//deleteProjectButton.addEventListener("click", openDeleteProjectModal);

/* =========================================
   CONFIRM DELETE MODAL
========================================= */

confirmDeleteProjectButton.addEventListener("click", confirmDeleteProject);
/* =========================================
   CLOSE MODAL
========================================= */

closeDeleteModalButton.addEventListener("click", closeDeleteProjectModal);

/* =========================================
   CLICK OUTSIDE MODAL
========================================= */

deleteModal.addEventListener("click", (event) => {
  if (event.target === deleteModal) {
    closeDeleteProjectModal();
  }
});

/* =========================================
   ESCAPE KEY
========================================= */

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && deleteModal.classList.contains("active")) {
    closeDeleteProjectModal();
  }
});

/* =========================================
   BROWSE PROJECT DIRECTORY
========================================= */

browseProjectButton.addEventListener("click", async () => {
  try {
    const selectedPath = await window.launcher.selectFolder();

    if (selectedPath) {
      document.getElementById("project-path").value = selectedPath;
    }
  } catch (error) {
    console.error("Failed to select folder:", error);
  }
});

/* =========================================
   ADD PROJECT FORM
========================================= */

addProjectForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  formError.textContent = "";

  formError.classList.remove("visible");

  /* =====================================
           GET FORM VALUES
        ===================================== */

  const id = document.getElementById("project-id").value.trim();

  const name = document.getElementById("project-name").value.trim();

  const projectPath = document.getElementById("project-path").value.trim();

  const command = document.getElementById("project-command").value.trim();

  const argsInput = document.getElementById("project-args").value.trim();

  /* =====================================
           BASIC VALIDATION
        ===================================== */

  if (!id || !name || !projectPath || !command) {
    showFormError("Please fill in all required fields.");

    return;
  }

  /* =====================================
           CONVERT ARGUMENTS
        ===================================== */

  const args = argsInput ? argsInput.split(/\s+/) : [];

  /* =====================================
           CREATE PROJECT OBJECT
        ===================================== */

  const project = {
    id: id,

    name: name,

    path: projectPath,

    command: command,

    args: args,
  };

  try {
    /* =================================
               SEND TO ELECTRON
            ================================= */

    const result = await window.launcher.addProject(project);

    /* =================================
               ERROR
            ================================= */

    if (!result.success) {
      showFormError(result.message);

      return;
    }

    /* =================================
               SUCCESS
            ================================= */

    output.textContent += `Project "${name}" added successfully.\n`;

    output.scrollTop = output.scrollHeight;

    /* Close modal */

    closeProjectModal();

    /* Reload project list */

    await loadProjects();
  } catch (error) {
    console.error("Failed to add project:", error);

    showFormError("Failed to add project.");
  }
});

/* =========================================
   SHOW FORM ERROR
========================================= */

function showFormError(message) {
  formError.textContent = message;

  formError.classList.add("visible");
}

/* =========================================
   ESCAPE HTML
========================================= */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");
}

/* =========================================
   LOAD PROJECTS
========================================= */

loadProjects();
