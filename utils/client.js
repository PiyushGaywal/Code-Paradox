document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("nameInput");
  const roomInput = document.getElementById("roomInput");
  const createBtn = document.getElementById("createBtn");
  const joinBtn = document.getElementById("joinBtn");

  nameInput.value = "";

  const urlParams = new URLSearchParams(window.location.search);
  const roomFromLink = urlParams.get("room");
  if (roomFromLink) {
    roomInput.value = roomFromLink;
    nameInput.focus();
  }

  createBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      alert("Please Enter Your Name");
      return;
    }

    localStorage.setItem("cc_name", name);

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);

    window.location.href = `/room/${id}?name=${encodeURIComponent(name)}`;
  });

  joinBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    if (!name) {
      alert("Please Enter Your Name");
      return;
    }

    const room = roomInput.value.trim();
    if (!room) {
      alert("Please enter a Room ID or click Create Room.");
      return;
    }

    localStorage.setItem("cc_name", name);
    window.location.href = `/room/${encodeURIComponent(room)}?name=${encodeURIComponent(name)}`;
  });

  [nameInput, roomInput].forEach((el) =>
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") joinBtn.click();
    })
  );
});
