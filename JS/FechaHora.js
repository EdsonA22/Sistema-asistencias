function actualizarReloj() {
  const ahora = new Date();
  document.getElementById("fecha-actual").innerText =
    "Fecha: " + ahora.toLocaleDateString("es-MX");
  document.getElementById("hora-actual").innerText =
    "Hora: " +
    ahora.toLocaleTimeString("es-MX", {
      hour: "2-digit",
      minute: "2-digit",
    });
}
setInterval(actualizarReloj, 1000);
actualizarReloj();
