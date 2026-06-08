const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const taskForm = document.getElementById("taskForm");
const taskTitle = document.getElementById("taskTitle");
const taskList = document.getElementById("taskList");
const settingsForm = document.getElementById("settingsForm");
const providerSelect = document.getElementById("providerSelect");
const apiKeyInput = document.getElementById("apiKeyInput");

// Load saved settings
const savedProvider = localStorage.getItem("jarves_provider") || "openai";
const savedApiKey = localStorage.getItem("jarves_openrouter_key") || "";
providerSelect.value = savedProvider;
apiKeyInput.value = savedApiKey;

// Save settings on change
settingsForm.addEventListener("change", () => {
  localStorage.setItem("jarves_provider", providerSelect.value);
  localStorage.setItem("jarves_openrouter_key", apiKeyInput.value);
});

// Parse G0DM0D3 race metadata from response
const parseGodmodeMetadata = (text) => {
  const raceMatch = text.match(/---\n🏆 Race Winner: (.+?) \(score: (\d+)\) from (\d+) models in ([\d.]+)s/);
  if (raceMatch) {
    return {
      winner: raceMatch[1],
      score: parseInt(raceMatch[2]),
      totalModels: parseInt(raceMatch[3]),
      duration: parseFloat(raceMatch[4]),
      fullText: raceMatch[0]
    };
  }
  return null;
};

const renderMessage = (speaker, text, provider = null) => {
  const item = document.createElement("div");
  item.className = "message";
  
  // Add special styling for G0DM0D3 responses
  if (provider === "godmode") {
    item.classList.add("godmode");
  }
  
  let content = `<strong>${speaker}</strong>`;
  
  // Parse and display G0DM0D3 race metadata
  if (provider === "godmode") {
    const metadata = parseGodmodeMetadata(text);
    if (metadata) {
      // Remove the metadata from the displayed text
      const cleanText = text.replace(metadata.fullText, "").trim();
      content += `<div>${cleanText.replace(/\n/g, "<br />")}</div>`;
      content += `<div class="winner-badge">🏆 Winner: ${metadata.winner}</div>`;
      content += `<div class="race-stats">Score: ${metadata.score} | ${metadata.totalModels} models | ${metadata.duration.toFixed(1)}s</div>`;
    } else {
      content += `<div>${text.replace(/\n/g, "<br />")}</div>`;
    }
  } else {
    content += `<div>${text.replace(/\n/g, "<br />")}</div>`;
  }
  
  item.innerHTML = content;
  chatWindow.appendChild(item);
  chatWindow.scrollTop = chatWindow.scrollHeight;
};

const loadTasks = async () => {
  const response = await fetch("/api/tasks");
  const data = await response.json();
  taskList.innerHTML = "";
  data.tasks.forEach((task) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${task.title}</span><button data-id="${task.id}">Delete</button>`;
    taskList.appendChild(li);
  });
};

const addTask = async (title) => {
  const response = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
  if (response.ok) {
    await loadTasks();
    taskTitle.value = "";
  }
};

const deleteTask = async (id) => {
  const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  if (response.ok) {
    await loadTasks();
  }
};

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  renderMessage("You", text);
  chatInput.value = "";

  const selectedProvider = providerSelect.value;
  const apiKey = apiKeyInput.value;

  const response = await fetch("/api/jarves", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ 
      message: text,
      provider: selectedProvider,
      apiKey: apiKey
    })
  });

  const data = await response.json();
  if (response.ok) {
    renderMessage("Jarves", data.reply, data.provider);
  } else {
    renderMessage("Jarves", data.error || "An error occurred.");
  }
});

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = taskTitle.value.trim();
  if (!title) return;
  await addTask(title);
});

taskList.addEventListener("click", async (event) => {
  if (event.target.tagName === "BUTTON") {
    const id = event.target.dataset.id;
    await deleteTask(id);
  }
});

loadTasks().catch(console.error);
