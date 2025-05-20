import { writable } from 'svelte/store'

const getPreferredTheme = () => {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('theme')
		if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
	}
	return 'system'
}

export const theme = writable(getPreferredTheme())

// Reactively update HTML class and localStorage
theme.subscribe(value => {
	if (typeof document === 'undefined') return

	localStorage.setItem('theme', value)

	const root = document.documentElement
	const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

	if (value === 'dark' || (value === 'system' && systemPrefersDark)) {
		root.classList.add('dark')
	} else {
		root.classList.remove('dark')
	}
})
