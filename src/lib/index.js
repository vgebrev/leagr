// place files you want to import through the `$lib` alias in this folder.
window.addEventListener('unhandledrejection', (event) => {
	console.warn('Unhandled rejection:', event.reason);
});
