import Options from "src/lib/Options.svelte";

const target = document.getElementById("app");

function render() {
  new Options({ target });
}

document.addEventListener("DOMContentLoaded", render);
