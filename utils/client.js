document.addEventListener("DOMContentLoaded", () => {
  const nameInput = document.getElementById("nameInput");
  const roomInput = document.getElementById("roomInput");
  const createBtn = document.getElementById("createBtn");
  const joinBtn = document.getElementById("joinBtn");

  nameInput.value ="";

  createBtn.addEventListener("click", () => {
    const name = nameInput.value.trim() || ("User" + Math.floor(Math.random()*1000));
    localStorage.setItem("cc_name", name);
    const id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : uuidv4();
    window.location.href = `/room/${id}?name=${encodeURIComponent(name)}`;
  });

  joinBtn.addEventListener("click", () => {
    const name = nameInput.value.trim()
    if(!name){
      alert("Please Enter Your Name")
      return
    }
    const room = roomInput.value.trim();
    if (!room) {
      alert("Please enter a Room ID or click Create Room.");
      return;
    }
    localStorage.setItem("cc_name", name);
    window.location.href = `/room/${encodeURIComponent(room)}?name=${encodeURIComponent(name)}`;
  });

  [nameInput, roomInput].forEach(el => el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") joinBtn.click();
  }));
});
