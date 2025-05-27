const defaultTheme = require("tailwindcss/defaultTheme");

/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                "transparent": "transparent",
                "primary": {
                    lightest: "#8fc5ea",
                    lighter: "#53a7dd",
                    DEFAULT: "#2980b9",
                    darker: "#1e6fab",
                    darkest: "#19598b"
                },
                "gray": {
                    lightest: "#e9ebec",
                    lighter: "#dee1e3",
                    DEFAULT: "#D4D7DA",
                    darker: "#AEB0B2",
                    darkest: "#6C757D"
                },
                "background": {
                    lightest: "#181c22",
                    lighter: "#14171d",
                    DEFAULT: "#0f1115",
                    darker: "#0d0f12",
                    darkest: "#0b0c0f"
                },
                "text": {
                    lightest: "",
                    light: "",
                    DEFAULT: "#eae5ff",
                    darker: "#AEB0B2",
                    darkest: "#6f6f71"
                },
                "white": "#ffffff"
            },
            screens: {
                '3xl': '112rem', // 1792px
                '4xl': '128rem'  // 2048px
            },
            maxWidth: {
                "loki": "120rem"
            },
            fontSize: {
                "4xs": "0.375rem",
                "3xs": "0.5rem",
                "2xs": "0.625rem"
            },
            fontFamily: {
                "loki": ["Inter", ...defaultTheme.fontFamily.sans],
                "loki-fredoka": ["Fredoka", ...defaultTheme.fontFamily.sans],
                "loki-oswald": ["Oswald", ...defaultTheme.fontFamily.sans]
            },
            borderWidth: {
                1: "1px",
            },
        },
    },
    plugins: [
        require("@tailwindcss/aspect-ratio"),
        require("@tailwindcss/typography"),
    ],
}
