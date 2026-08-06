export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Superficies de la app. Antes vivían como valores sueltos entre corchetes
      // repetidos por todos los componentes.
      colors: {
        base: "#0f0f13", // fondo de la ventana principal
        panel: "#13131a", // barra lateral y panel de detalle
        popup: "#1a1a2e", // ventana de captura rápida
        elevated: "#22223a", // menús flotantes sobre el popup
      },
    },
  },
  plugins: [],
};
