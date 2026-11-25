import { createVuetify } from "vuetify";
import { loadFonts } from "./webfontloader.js";

loadFonts();

import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";

/**
 * OC Academic Edition
 * Design tokens: .cursor/rules/ui-style-system.mdc
 * Hex values live here only — components use theme color names.
 */
const ocAcademic = {
  dark: false,
  colors: {
    primary: "#801328",
    "primary-container": "#FFDAD9",
    "on-primary": "#FFFFFF",
    secondary: "#775656",
    "secondary-container": "#FFDAD9",
    "on-secondary": "#FFFFFF",
    surface: "#F9F9FF",
    "surface-variant": "#E7E0E1",
    "on-surface": "#1C1B1F",
    background: "#FFFFFF",
    "on-background": "#1C1B1F",
    outline: "#857373",
    error: "#B3261E",
    "on-error": "#FFFFFF",
    success: "#2E7D32",
    warning: "#E65100",
    info: "#775656",
  },
};

// Components and directives are imported per use by vite-plugin-vuetify (autoImport).
const vuetify = createVuetify({
  theme: {
    defaultTheme: "ocAcademic",
    themes: { ocAcademic },
  },
  defaults: {
    VBtn: {
      rounded: "lg",
    },
    VCard: {
      rounded: "lg",
      color: "surface",
    },
    VTextField: {
      density: "comfortable",
      rounded: "lg",
    },
    VAlert: {
      density: "compact",
    },
    VDialog: {
      scrim: true,
    },
  },
  icons: { defaultSet: "mdi" },
});

export default vuetify;
