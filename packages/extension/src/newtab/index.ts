import Rabbithole from "src/lib/Rabbithole.svelte";

// global styles
import "./styles.css";

const target = document.getElementById("app");

function render() {
  new Rabbithole({
    target,
  });
}

document.addEventListener("DOMContentLoaded", render);
