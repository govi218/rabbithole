/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: {
				sans: ['Futura', 'system-ui', 'sans-serif'],
				display: ['"Share Tech"', 'system-ui', 'sans-serif']
			}
		}
	},
	plugins: []
};
