const frame = document.querySelector("#comparison");
const slider = frame.querySelector(".wipe");
const beforeLabel = frame.querySelector(".tag-a");
const afterLabel = frame.querySelector(".tag-b");
function updateComparison() {
  const value = Number(slider.value);
  frame.style.setProperty("--cut", value + "%");
  beforeLabel.hidden = value < 16;
  afterLabel.hidden = value > 84;
}
slider.addEventListener("input", updateComparison);
updateComparison();

