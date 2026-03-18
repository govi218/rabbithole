import Popup from "src/lib/Popup.svelte";

const target = document.getElementById("app");

if (target) {
  new Popup({
    target,
  });
}
