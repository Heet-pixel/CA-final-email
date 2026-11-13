/* Vision 2030 – expandable panels (accessible: real buttons, aria-expanded, keyboard works out of the box) */
(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll(".v2030-item"));
  var all = document.getElementById("v2030-all");
  if (!items.length) return;

  function set(item, open) {
    item.setAttribute("data-open", open ? "true" : "false");
    item.querySelector(".v2030-btn").setAttribute("aria-expanded", open ? "true" : "false");
  }
  function sync() {
    var every = items.every(function (i) { return i.getAttribute("data-open") === "true"; });
    if (all) { all.textContent = every ? "Collapse all" : "Expand all"; all.setAttribute("aria-pressed", every ? "true" : "false"); }
  }
  items.forEach(function (item) {
    item.querySelector(".v2030-btn").addEventListener("click", function () {
      set(item, item.getAttribute("data-open") !== "true");
      sync();
    });
  });
  if (all) all.addEventListener("click", function () {
    var open = !items.every(function (i) { return i.getAttribute("data-open") === "true"; });
    items.forEach(function (i) { set(i, open); });
    sync();
  });
  sync();
})();
